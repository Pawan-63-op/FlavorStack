import { DomainEvent } from '../../shared/DomainEvent';
import { UserRole } from '../enums/user-role.enum';
import { randomUUID } from 'crypto';

export class UserRegistered implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventName = 'UserRegistered';
  public readonly aggregateId: string;

  constructor(
    userId: string,
    public readonly email: string,
    public readonly role: UserRole,
    public readonly name: string
  ) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = userId;
  }
}
