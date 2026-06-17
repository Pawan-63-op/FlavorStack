import { CartCleared } from '../../../../../domain/commerce/events/CartCleared';

describe('CartCleared domain event', () => {
  it('carries the cartId as the aggregateId', () => {
    const event = new CartCleared('cart-1');

    expect(event.eventName).toBe('CartCleared');
    expect(event.aggregateId).toBe('cart-1');
    expect(event.eventId).toBeTruthy();
    expect(event.occurredOn).toBeInstanceOf(Date);
  });
});
