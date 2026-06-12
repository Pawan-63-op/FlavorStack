import { DomainEvent } from '../../shared/DomainEvent';
import { randomUUID } from 'crypto';

export class DriverSuspended implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventName = 'DriverSuspended';
  public readonly aggregateId: string;

  constructor(
    driverId: string,
    public readonly reason: string,
    public readonly suspendedAt: Date
  ) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = driverId;
  }
}
