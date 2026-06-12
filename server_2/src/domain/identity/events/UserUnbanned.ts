import { DomainEvent } from '../../shared/DomainEvent';
import { randomUUID } from 'crypto';

export class UserUnbanned implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventName = 'UserUnbanned';
  public readonly aggregateId: string;

  constructor(
    userId: string,
    public readonly unbannedAt: Date
  ) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = userId;
  }
}
