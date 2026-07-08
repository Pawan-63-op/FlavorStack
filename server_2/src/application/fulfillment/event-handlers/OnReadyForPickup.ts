import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { OfferRiderAssignment } from '../use-cases/OfferRiderAssignment';
import { logger } from '../../../infrastructure/observability/logger';

export class OnReadyForPickup {
  private readonly processedEventIds = new Set<string>();

  constructor(private readonly offerRiderAssignment: OfferRiderAssignment) {}

  async handle(event: DomainEvent): Promise<void> {
    if (this.processedEventIds.has(event.eventId)) return;

    const result = await this.offerRiderAssignment.execute({ fulfillmentId: event.aggregateId });
    if (result.isFailure) {
      logger.info(
        { eventId: event.eventId, fulfillmentId: event.aggregateId, reason: String(result.getError()) },
        '[OnReadyForPickup] no rider offered'
      );
      return;
    }

    this.processedEventIds.add(event.eventId);
  }
}
