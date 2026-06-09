import { DomainEvent } from '../../shared/DomainEvent';
import { randomUUID } from 'crypto';

export class UserBanned implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventName = 'UserBanned';
  public readonly aggregateId: string;

  constructor(
    userId: string,
    public readonly reason: string,
    public readonly bannedAt: Date
  ) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = userId;
  }
}
