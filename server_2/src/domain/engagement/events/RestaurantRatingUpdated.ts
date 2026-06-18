// Domain event raised when a restaurant's recomputed rating changes (engagement_module.md §3).
// aggregateId = restaurantId. Publish-only for now — routed to no queue (no Catalog consumer yet).
import { DomainEvent } from '../../shared/DomainEvent';
import { randomUUID } from 'crypto';

export interface RestaurantRatingUpdatedPayload {
  restaurantId: string;
  avgRating: number;
  reviewCount: number;
}

export class RestaurantRatingUpdated implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventName = 'RestaurantRatingUpdated';
  public readonly aggregateId: string;

  public readonly avgRating: number;
  public readonly reviewCount: number;

  constructor(payload: RestaurantRatingUpdatedPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = payload.restaurantId;

    this.avgRating = payload.avgRating;
    this.reviewCount = payload.reviewCount;
  }
}
