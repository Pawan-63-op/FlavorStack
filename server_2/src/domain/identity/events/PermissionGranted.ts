import { DomainEvent } from '../../shared/DomainEvent';
import { PermissionResource } from '../enums/permission-resource.enum';
import { PermissionAction } from '../enums/permission-action.enum';
import { randomUUID } from 'crypto';

export class PermissionGranted implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventName = 'PermissionGranted';
  public readonly aggregateId: string;

  constructor(
    adminId: string,
    public readonly resource: PermissionResource,
    public readonly action: PermissionAction,
    public readonly scope?: string
  ) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = adminId;
  }
}
