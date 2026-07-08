import { DomainEvent } from '../../shared/DomainEvent';
import { randomUUID } from 'crypto';

export class CartCleared implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventName = 'CartCleared';
  public readonly aggregateId: string;

  constructor(cartId: string) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = cartId;
  }
}
