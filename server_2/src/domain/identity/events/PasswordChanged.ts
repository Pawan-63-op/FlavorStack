import { DomainEvent } from '../../shared/DomainEvent';
import { randomUUID } from 'crypto';

export class PasswordChanged implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventName = 'PasswordChanged';
  public readonly aggregateId: string;

  constructor(
    userId: string,
    public readonly changedAt: Date
  ) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = userId;
  }
}
