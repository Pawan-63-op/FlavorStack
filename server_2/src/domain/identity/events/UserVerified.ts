import { DomainEvent } from '../../shared/DomainEvent';
import { randomUUID } from 'crypto';

export class UserVerified implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventName = 'UserVerified';
  public readonly aggregateId: string;

  constructor(
    userId: string,
    public readonly email: string,
    public readonly verifiedAt: Date
  ) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = userId;
  }
}
