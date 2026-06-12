import { DomainEvent } from '../../shared/DomainEvent';
import { randomUUID } from 'crypto';

export class DriverVerified implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventName = 'DriverVerified';
  public readonly aggregateId: string;

  constructor(
    driverId: string,
    public readonly verifiedAt: Date
  ) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = driverId;
  }
}
