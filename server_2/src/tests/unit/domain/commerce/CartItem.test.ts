import { CartItem } from '../../../../domain/commerce/entities/CartItem';
import { Quantity } from '../../../../domain/commerce/value-objects/Quantity';
import { Money } from '../../../../domain/shared/Money';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';

function buildProps(overrides: Partial<{
  menuItemId: string;
  quantity: Quantity;
  selectedOptionIds: string[];
  unitPriceSnapshot: Money;
}> = {}) {
  return {
    menuItemId: 'menu-1',
    quantity: Quantity.create(2).getValue(),
    selectedOptionIds: ['opt-1'],
    unitPriceSnapshot: Money.create(15000, 'INR').getValue(),
    ...overrides,
  };
}

describe('CartItem entity', () => {
  describe('create', () => {
    it('creates a valid cart item', () => {
      const result = CartItem.create(buildProps());

      expect(result.isSuccess).toBe(true);
      const item = result.getValue();
      expect(item.menuItemId).toBe('menu-1');
      expect(item.quantity.value).toBe(2);
      expect(item.selectedOptionIds).toEqual(['opt-1']);
      expect(item.unitPriceSnapshot.amount).toBe(15000);
    });

    it('rejects an empty menuItemId', () => {
      const result = CartItem.create(buildProps({ menuItemId: '' }));

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('rejects a non-Money unitPriceSnapshot', () => {
      const result = CartItem.create({ ...buildProps(), unitPriceSnapshot: 100 as any });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('rejects a non-array selectedOptionIds', () => {
      const result = CartItem.create({ ...buildProps(), selectedOptionIds: 'opt-1' as any });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });
  });

  describe('matchesSelection', () => {
    it('returns true for the same menu item and option set regardless of order', () => {
      const item = CartItem.create(buildProps({ selectedOptionIds: ['opt-1', 'opt-2'] })).getValue();

      expect(item.matchesSelection('menu-1', ['opt-2', 'opt-1'])).toBe(true);
    });

    it('returns false for a different menu item', () => {
      const item = CartItem.create(buildProps()).getValue();

      expect(item.matchesSelection('menu-2', ['opt-1'])).toBe(false);
    });

    it('returns false for a different option set', () => {
      const item = CartItem.create(buildProps({ selectedOptionIds: ['opt-1'] })).getValue();

      expect(item.matchesSelection('menu-1', ['opt-2'])).toBe(false);
    });
  });

  describe('increaseQuantity', () => {
    it('adds to the current quantity', () => {
      const item = CartItem.create(buildProps({ quantity: Quantity.create(2).getValue() })).getValue();

      const result = item.increaseQuantity(Quantity.create(3).getValue());

      expect(result.isSuccess).toBe(true);
      expect(item.quantity.value).toBe(5);
    });

    it('fails when the resulting quantity exceeds the maximum', () => {
      const item = CartItem.create(buildProps({ quantity: Quantity.create(Quantity.MAX).getValue() })).getValue();

      const result = item.increaseQuantity(Quantity.create(1).getValue());

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
      expect(item.quantity.value).toBe(Quantity.MAX);
    });
  });

  describe('changeQuantity', () => {
    it('replaces the quantity', () => {
      const item = CartItem.create(buildProps({ quantity: Quantity.create(2).getValue() })).getValue();

      const result = item.changeQuantity(Quantity.create(7).getValue());

      expect(result.isSuccess).toBe(true);
      expect(item.quantity.value).toBe(7);
    });
  });

  describe('lineTotal', () => {
    it('multiplies unit price by quantity', () => {
      const item = CartItem.create(buildProps({
        quantity: Quantity.create(3).getValue(),
        unitPriceSnapshot: Money.create(10000, 'INR').getValue(),
      })).getValue();

      const total = item.lineTotal();

      expect(total.amount).toBe(30000);
      expect(total.currency).toBe('INR');
    });
  });
});
