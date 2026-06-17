import { CartItemAdded } from '../../../../../domain/commerce/events/CartItemAdded';

describe('CartItemAdded domain event', () => {
  it('carries cartId, menuItemId and quantity', () => {
    const event = new CartItemAdded('cart-1', 'menu-1', 2);

    expect(event.eventName).toBe('CartItemAdded');
    expect(event.aggregateId).toBe('cart-1');
    expect(event.menuItemId).toBe('menu-1');
    expect(event.quantity).toBe(2);
    expect(event.eventId).toBeTruthy();
    expect(event.occurredOn).toBeInstanceOf(Date);
  });

  it('generates a unique eventId per instance', () => {
    const a = new CartItemAdded('cart-1', 'menu-1', 1);
    const b = new CartItemAdded('cart-1', 'menu-1', 1);

    expect(a.eventId).not.toBe(b.eventId);
  });
});
