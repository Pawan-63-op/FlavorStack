// UC: RecordRiderLocation — ingests one rider GPS ping (fulfillment_module.md §6.1, §9, Phase 7).
//
// This is the ONLY fulfillment "command" that writes NO aggregate state (§6.1 marks it
// "no aggregate write"). High-frequency GPS is kept out of the `Fulfillment` aggregate to avoid
// write amplification / optimistic-concurrency contention (§2.3). It instead fans out to a
// Redis latest-location cache, a throttled Mongo history store, and the realtime room.
//
// Flow (also see fulfillment_module.md §9):
//
//   rider (WS `location` every ~5s  ── or ──  POST /fulfillments/:id/location)
//        │
//        ▼
//   ┌──────────────────────── RecordRiderLocation ────────────────────────┐
//   │ 1. validate (lat,lng) as a GeoPoint            (fail fast)           │
//   │ 2. load Fulfillment (READ ONLY — no write)                          │
//   │ 3. ownership guard: rider must be the ACCEPTED rider of an active    │
//   │    (non-terminal) delivery                                           │
//   │ 4. liveLocationStore.setLatest(...)            → Redis (every ping)   │
//   │ 5. broadcaster.broadcastLocation(...)          → `tracking:location`  │
//   │    (Redis adapter fans out across instances)                         │
//   │ 6. IF throttle slot open → trackingStore.append(...) → Mongo         │
//   └─────────────────────────────────────────────────────────────────────┘
//
// No outbox/event publication: a GPS ping is not a domain event.
import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../domain/shared/errors/ForbiddenError';
import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';
import { RIDER_ASSIGNMENT_STATUS } from '../../../domain/fulfillment/enums/rider-assignment-status.enum';
import { IFulfillmentRepository } from '../../../domain/fulfillment/repositories/IFulfillmentRepository';
import { ILiveLocationStore } from '../ports/ILiveLocationStore';
import { IDeliveryTrackingStore } from '../ports/IDeliveryTrackingStore';
import { ITrackingBroadcaster } from '../ports/ITrackingBroadcaster';
import { RiderLocationSnapshot } from '../ports/RiderLocationSnapshot';
import { RecordRiderLocationDto } from '../dtos/RecordRiderLocationDto';

export interface RecordRiderLocationResult {
  recordedAt: string;
  persisted: boolean;
}

export class RecordRiderLocation {
  constructor(
    private readonly fulfillmentRepo: IFulfillmentRepository,
    private readonly liveLocationStore: ILiveLocationStore,
    private readonly trackingStore: IDeliveryTrackingStore,
    private readonly broadcaster: ITrackingBroadcaster,
    private readonly persistThrottleSeconds: number
  ) {}

  async execute(dto: RecordRiderLocationDto): Promise<Result<RecordRiderLocationResult>> {
    // 1. Validate the coordinates as a GeoPoint (reuses Identity's lat/lng VO).
    const geo = GeoPoint.create(dto.lat, dto.lng);
    if (geo.isFailure) {
      return Result.fail(geo.getError());
    }

    // 2. Load the aggregate — READ ONLY. We never call a mutating method or persist it here.
    const fulfillment = await this.fulfillmentRepo.findById(dto.fulfillmentId);
    if (!fulfillment) {
      return Result.fail(new NotFoundError('Fulfillment not found', { fulfillmentId: dto.fulfillmentId }));
    }

    // 3. Ownership: the ping must come from the rider who currently owns an active delivery.
    const assignment = fulfillment.currentAssignment;
    const ownsActiveDelivery =
      !!assignment &&
      assignment.riderId === dto.riderId &&
      assignment.status.value === RIDER_ASSIGNMENT_STATUS.ACCEPTED &&
      !fulfillment.deliveryStatus.isTerminal() &&
      !fulfillment.fulfillmentStatus.isTerminal();

    if (!ownsActiveDelivery) {
      return Result.fail(new ForbiddenError('Rider does not own an active delivery for this fulfillment'));
    }

    // 4. Latest-location cache (Redis) — overwritten every ping for O(1) reads.
    const snapshot: RiderLocationSnapshot = {
      fulfillmentId: dto.fulfillmentId,
      riderId: dto.riderId,
      lat: dto.lat,
      lng: dto.lng,
      recordedAt: new Date(),
    };
    await this.liveLocationStore.setLatest(snapshot);

    // 5. Broadcast to the room (every ping). Redis adapter handles cross-instance fan-out.
    this.broadcaster.broadcastLocation(dto.fulfillmentId, {
      fulfillmentId: snapshot.fulfillmentId,
      riderId: snapshot.riderId,
      lat: snapshot.lat,
      lng: snapshot.lng,
      recordedAt: snapshot.recordedAt.toISOString(),
    });

    // 6. Throttled durable persistence — at most ~1 write / window across all instances.
    let persisted = false;
    if (await this.liveLocationStore.tryAcquirePersistSlot(dto.fulfillmentId, this.persistThrottleSeconds)) {
      await this.trackingStore.append(snapshot);
      persisted = true;
    }

    return Result.ok({ recordedAt: snapshot.recordedAt.toISOString(), persisted });
  }
}
