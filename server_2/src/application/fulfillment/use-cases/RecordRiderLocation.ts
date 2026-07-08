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
    const geo = GeoPoint.create(dto.lat, dto.lng);
    if (geo.isFailure) {
      return Result.fail(geo.getError());
    }

    const fulfillment = await this.fulfillmentRepo.findById(dto.fulfillmentId);
    if (!fulfillment) {
      return Result.fail(new NotFoundError('Fulfillment not found', { fulfillmentId: dto.fulfillmentId }));
    }

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

    const snapshot: RiderLocationSnapshot = {
      fulfillmentId: dto.fulfillmentId,
      riderId: dto.riderId,
      lat: dto.lat,
      lng: dto.lng,
      recordedAt: new Date(),
    };
    await this.liveLocationStore.setLatest(snapshot);

    this.broadcaster.broadcastLocation(dto.fulfillmentId, {
      fulfillmentId: snapshot.fulfillmentId,
      riderId: snapshot.riderId,
      lat: snapshot.lat,
      lng: snapshot.lng,
      recordedAt: snapshot.recordedAt.toISOString(),
    });

    let persisted = false;
    if (await this.liveLocationStore.tryAcquirePersistSlot(dto.fulfillmentId, this.persistThrottleSeconds)) {
      await this.trackingStore.append(snapshot);
      persisted = true;
    }

    return Result.ok({ recordedAt: snapshot.recordedAt.toISOString(), persisted });
  }
}
