import { DomainEvent } from '../../shared/DomainEvent';
import { randomUUID } from 'crypto';

export class PasswordResetCompleted implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventName = 'PasswordResetCompleted';
  public readonly aggregateId: string;

  constructor(
    userId: string,
    public readonly completedAt: Date
  ) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = userId;
  }
}
