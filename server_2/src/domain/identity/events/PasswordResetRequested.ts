import { DomainEvent } from '../../shared/DomainEvent';
import { randomUUID } from 'crypto';

export class PasswordResetRequested implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventName = 'PasswordResetRequested';
  public readonly aggregateId: string;

  constructor(
    userId: string,
    public readonly email: string,
    public readonly requestedAt: Date
  ) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = userId;
  }
}
