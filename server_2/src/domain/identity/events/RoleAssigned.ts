import { DomainEvent } from '../../shared/DomainEvent';
import { UserRole } from '../enums/user-role.enum';
import { randomUUID } from 'crypto';

export class RoleAssigned implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventName = 'RoleAssigned';
  public readonly aggregateId: string;

  constructor(
    userId: string,
    public readonly assignedRole: UserRole,
    public readonly assignedBy: string
  ) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = userId;
  }
}
