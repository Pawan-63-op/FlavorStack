import { Cart } from '../../../../domain/commerce/entities/Cart';
import { LineItemSelection } from '../../../../domain/commerce/value-objects/LineItemSelection';
import { Quantity } from '../../../../domain/commerce/value-objects/Quantity';
import { Money } from '../../../../domain/shared/Money';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';
import { ConflictError } from '../../../../domain/shared/errors/ConflictError';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';

function selection(overrides: Partial<{ menuItemId: string; selectedOptionIds: string[]; quantity: number }> = {}) {
  return LineItemSelection.create({
    menuItemId: 'menu-1',
    selectedOptionIds: [],
    quantity: 1,
    ...overrides,
  }).getValue();
}

function money(amount: number, currency = 'INR') {
  return Money.create(amount, currency).getValue();
}

describe('Cart aggregate', () => {
  describe('create', () => {
    it('creates an empty cart for a customer', () => {
      const result = Cart.create('customer-1');

      expect(result.isSuccess).toBe(true);
      const cart = result.getValue();
      expect(cart.customerId).toBe('customer-1');
      expect(cart.restaurantId).toBeNull();
      expect(cart.items).toEqual([]);
      expect(cart.currency).toBeNull();
      expect(cart.version).toBe(0);
    });

    it('rejects an empty customerId', () => {
      const result = Cart.create('');

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });
  });

  describe('addItem', () => {
    it('adds the first item, binding restaurant and currency', () => {
      const cart = Cart.create('customer-1').getValue();

      const result = cart.addItem('restaurant-1', selection({ quantity: 2 }), money(15000));

      expect(result.isSuccess).toBe(true);
      expect(cart.restaurantId).toBe('restaurant-1');
      expect(cart.currency).toBe('INR');
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].menuItemId).toBe('menu-1');
      expect(cart.items[0].quantity.value).toBe(2);
      expect(cart.version).toBe(1);
    });

    // Phase 6: cart mutations raise no domain events — nothing subscribed to them, and the
    // cart's state is the only thing any reader cares about.
    it('raises no domain event', () => {
      const cart = Cart.create('customer-1').getValue();

      cart.addItem('restaurant-1', selection({ menuItemId: 'menu-1', quantity: 2 }), money(15000));

      expect(cart.pullDomainEvents()).toEqual([]);
    });

    it('merges identical lines by summing quantity', () => {
      const cart = Cart.create('customer-1').getValue();
      cart.addItem('restaurant-1', selection({ menuItemId: 'menu-1', selectedOptionIds: ['opt-1'], quantity: 2 }), money(15000));

      const result = cart.addItem('restaurant-1', selection({ menuItemId: 'menu-1', selectedOptionIds: ['opt-1'], quantity: 3 }), money(15000));

      expect(result.isSuccess).toBe(true);
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].quantity.value).toBe(5);
    });

    it('adds a second distinct line item from the same restaurant', () => {
      const cart = Cart.create('customer-1').getValue();
      cart.addItem('restaurant-1', selection({ menuItemId: 'menu-1', quantity: 1 }), money(15000));

      const result = cart.addItem('restaurant-1', selection({ menuItemId: 'menu-2', quantity: 1 }), money(20000));

      expect(result.isSuccess).toBe(true);
      expect(cart.items).toHaveLength(2);
    });

    it('rejects items from a different restaurant (single-restaurant invariant)', () => {
      const cart = Cart.create('customer-1').getValue();
      cart.addItem('restaurant-1', selection({ menuItemId: 'menu-1' }), money(15000));

      const result = cart.addItem('restaurant-2', selection({ menuItemId: 'menu-2' }), money(15000));

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ConflictError);
      expect(cart.items).toHaveLength(1);
    });

    it('rejects items with a different currency (currency invariant)', () => {
      const cart = Cart.create('customer-1').getValue();
      cart.addItem('restaurant-1', selection({ menuItemId: 'menu-1' }), money(15000, 'INR'));

      const result = cart.addItem('restaurant-1', selection({ menuItemId: 'menu-2' }), money(100, 'USD'));

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
      expect(cart.items).toHaveLength(1);
    });

    it('rejects an empty restaurantId', () => {
      const cart = Cart.create('customer-1').getValue();

      const result = cart.addItem('', selection(), money(15000));

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });
  });

  describe('removeItem', () => {
    it('removes an existing item', () => {
      const cart = Cart.create('customer-1').getValue();
      cart.addItem('restaurant-1', selection({ menuItemId: 'menu-1' }), money(15000));
      cart.addItem('restaurant-1', selection({ menuItemId: 'menu-2' }), money(15000));
      const itemId = cart.items[0].id.toString();

      const result = cart.removeItem(itemId);

      expect(result.isSuccess).toBe(true);
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].menuItemId).toBe('menu-2');
    });

    it('fails when the item does not exist', () => {
      const cart = Cart.create('customer-1').getValue();

      const result = cart.removeItem('non-existent');

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(NotFoundError);
    });

    it('clears restaurantId and currency when the cart becomes empty', () => {
      const cart = Cart.create('customer-1').getValue();
      cart.addItem('restaurant-1', selection({ menuItemId: 'menu-1' }), money(15000));
      const itemId = cart.items[0].id.toString();

      cart.removeItem(itemId);

      expect(cart.items).toHaveLength(0);
      expect(cart.restaurantId).toBeNull();
      expect(cart.currency).toBeNull();
    });

    it('keeps restaurantId and currency when other items remain', () => {
      const cart = Cart.create('customer-1').getValue();
      cart.addItem('restaurant-1', selection({ menuItemId: 'menu-1' }), money(15000));
      cart.addItem('restaurant-1', selection({ menuItemId: 'menu-2' }), money(15000));
      const itemId = cart.items[0].id.toString();

      cart.removeItem(itemId);

      expect(cart.restaurantId).toBe('restaurant-1');
      expect(cart.currency).toBe('INR');
    });
  });

  describe('updateQuantity', () => {
    it('updates the quantity of an existing item', () => {
      const cart = Cart.create('customer-1').getValue();
      cart.addItem('restaurant-1', selection({ menuItemId: 'menu-1', quantity: 1 }), money(15000));
      const itemId = cart.items[0].id.toString();

      const result = cart.updateQuantity(itemId, Quantity.create(5).getValue());

      expect(result.isSuccess).toBe(true);
      expect(cart.items[0].quantity.value).toBe(5);
    });

    it('fails when the item does not exist', () => {
      const cart = Cart.create('customer-1').getValue();

      const result = cart.updateQuantity('non-existent', Quantity.create(2).getValue());

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(NotFoundError);
    });
  });

  describe('clear', () => {
    it('resets items, restaurantId and currency', () => {
      const cart = Cart.create('customer-1').getValue();
      cart.addItem('restaurant-1', selection({ menuItemId: 'menu-1' }), money(15000));
      cart.addItem('restaurant-1', selection({ menuItemId: 'menu-2' }), money(15000));

      const result = cart.clear();

      expect(result.isSuccess).toBe(true);
      expect(cart.items).toEqual([]);
      expect(cart.restaurantId).toBeNull();
      expect(cart.currency).toBeNull();
    });

    it('raises no domain event', () => {
      const cart = Cart.create('customer-1').getValue();
      cart.addItem('restaurant-1', selection({ menuItemId: 'menu-1' }), money(15000));
      cart.pullDomainEvents();

      cart.clear();

      expect(cart.pullDomainEvents()).toEqual([]);
    });
  });

  describe('mutations only via aggregate methods', () => {
    it('returns copies of items so external mutation does not affect internal state', () => {
      const cart = Cart.create('customer-1').getValue();
      cart.addItem('restaurant-1', selection({ menuItemId: 'menu-1' }), money(15000));

      const items = cart.items;
      items.pop();

      expect(cart.items).toHaveLength(1);
    });
  });
});
