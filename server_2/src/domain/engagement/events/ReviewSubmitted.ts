import { DomainEvent } from '../../shared/DomainEvent';
import { randomUUID } from 'crypto';
import { ModerationStatusValue } from '../enums/moderation-status.enum';

export interface ReviewSubmittedPayload {
  reviewId: string;
  customerId: string;
  restaurantId: string;
  fulfillmentId: string;
  restaurantRating: number;
  deliveryRating: number | null;
  hasComment: boolean;
  moderationStatus: ModerationStatusValue;
}

export class ReviewSubmitted implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventName = 'ReviewSubmitted';
  public readonly aggregateId: string;

  public readonly customerId: string;
  public readonly restaurantId: string;
  public readonly fulfillmentId: string;
  public readonly restaurantRating: number;
  public readonly deliveryRating: number | null;
  public readonly hasComment: boolean;
  public readonly moderationStatus: ModerationStatusValue;

  constructor(payload: ReviewSubmittedPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = payload.reviewId;

    this.customerId = payload.customerId;
    this.restaurantId = payload.restaurantId;
    this.fulfillmentId = payload.fulfillmentId;
    this.restaurantRating = payload.restaurantRating;
    this.deliveryRating = payload.deliveryRating;
    this.hasComment = payload.hasComment;
    this.moderationStatus = payload.moderationStatus;
  }
}
