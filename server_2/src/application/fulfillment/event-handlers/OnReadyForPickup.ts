// Event handler: auto-offer a rider when food becomes ready (fulfillment_module.md §3.1, §5.2 —
// "ReadyForPickup → assignment trigger", Phase 3B). Subscribed to the in-process bus alongside the
// restaurant flow's publish; OutboxProcessor may also replay the same row, so this is idempotent.
//
// Idempotency is layered: an in-memory eventId guard skips redelivery within a process, and the
// aggregate's "one active assignment" invariant makes a duplicate trigger a no-op (offerToRider fails
// while an offer is already live). Best-effort: a failure (e.g. no rider available) is logged, not thrown.
import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { OfferRiderAssignment } from '../use-cases/OfferRiderAssignment';
import { logger } from '../../../infrastructure/observability/logger';

export class OnReadyForPickup {
  private readonly processedEventIds = new Set<string>();

  constructor(private readonly offerRiderAssignment: OfferRiderAssignment) {}

  async handle(event: DomainEvent): Promise<void> {
    if (this.processedEventIds.has(event.eventId)) return;

    // aggregateId on ReadyForPickup is the fulfillmentId.
    const result = await this.offerRiderAssignment.execute({ fulfillmentId: event.aggregateId });
    if (result.isFailure) {
      // Do NOT mark processed on a transient failure so a redelivery can re-attempt.
      logger.info(
        { eventId: event.eventId, fulfillmentId: event.aggregateId, reason: String(result.getError()) },
        '[OnReadyForPickup] no rider offered'
      );
      return;
    }

    this.processedEventIds.add(event.eventId);
  }
}
