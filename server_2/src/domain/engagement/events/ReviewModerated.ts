import { DomainEvent } from '../../shared/DomainEvent';
import { randomUUID } from 'crypto';
import { ModerationStatusValue } from '../enums/moderation-status.enum';

export interface ReviewModeratedPayload {
  reviewId: string;
  restaurantId: string;
  status: ModerationStatusValue;
  moderatorId: string;
}

export class ReviewModerated implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventName = 'ReviewModerated';
  public readonly aggregateId: string;

  public readonly restaurantId: string;
  public readonly status: ModerationStatusValue;
  public readonly moderatorId: string;

  constructor(payload: ReviewModeratedPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = payload.reviewId;

    this.restaurantId = payload.restaurantId;
    this.status = payload.status;
    this.moderatorId = payload.moderatorId;
  }
}
