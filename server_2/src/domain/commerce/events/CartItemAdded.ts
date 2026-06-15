import { DomainEvent } from '../../shared/DomainEvent';
import { randomUUID } from 'crypto';

// Domain event (in-process only, not outbox-routed): cartId, menuItemId, quantity
export class CartItemAdded implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventName = 'CartItemAdded';
  public readonly aggregateId: string;

  constructor(cartId: string, public readonly menuItemId: string, public readonly quantity: number) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = cartId;
  }
}
