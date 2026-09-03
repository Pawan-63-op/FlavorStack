import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { AssignRider } from '../use-cases/AssignRider';
import { logger } from '../../../infrastructure/observability/logger';

export class OnReadyForPickup {
  constructor(private readonly assignRider: AssignRider) {}

  async handle(event: DomainEvent): Promise<void> {
    const result = await this.assignRider.execute({ fulfillmentId: event.aggregateId });
    if (result.isFailure) {
      logger.info(
        { eventId: event.eventId, fulfillmentId: event.aggregateId, reason: String(result.getError()) },
        '[OnReadyForPickup] no rider offered'
      );
      return;
    }
  }
}
