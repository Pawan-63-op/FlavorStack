import { DomainEvent } from '../../shared/DomainEvent';
import { randomUUID } from 'crypto';

export interface PreparationStartedPayload {
  fulfillmentId: string;
  restaurantId: string;
  prepEstimateMinutes?: number;
}

export class PreparationStarted implements DomainEvent {
  readonly eventId: string;
  readonly occurredOn: Date;
  readonly eventName = 'PreparationStarted';
  readonly aggregateId: string;
  readonly restaurantId: string;
  readonly prepEstimateMinutes?: number;

  constructor(payload: PreparationStartedPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = payload.fulfillmentId;
    this.restaurantId = payload.restaurantId;
    this.prepEstimateMinutes = payload.prepEstimateMinutes;
  }
}
