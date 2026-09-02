import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { OfferRiderAssignment } from '../use-cases/OfferRiderAssignment';
import { logger } from '../../../infrastructure/observability/logger';

export class OnReadyForPickup {
  constructor(private readonly offerRiderAssignment: OfferRiderAssignment) {}

  async handle(event: DomainEvent): Promise<void> {
    const result = await this.offerRiderAssignment.execute({ fulfillmentId: event.aggregateId });
    if (result.isFailure) {
      logger.info(
        { eventId: event.eventId, fulfillmentId: event.aggregateId, reason: String(result.getError()) },
        '[OnReadyForPickup] no rider offered'
      );
      return;
    }
  }
}
