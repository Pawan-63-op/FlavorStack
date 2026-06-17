import { OrderRequestLine } from '../../../../../domain/commerce/entities/OrderRequestLine';
import { MenuItemSnapshot } from '../../../../../domain/commerce/value-objects/snapshots/MenuItemSnapshot';
import { VariantSnapshot } from '../../../../../domain/commerce/value-objects/snapshots/VariantSnapshot';
import { Quantity } from '../../../../../domain/commerce/value-objects/Quantity';
import { Money } from '../../../../../domain/shared/Money';

const money = (amount: number, currency = 'INR') => Money.create(amount, currency).getValue();
const qty = (n: number) => Quantity.create(n).getValue();

const menuItem = (basePrice: number, currency = 'INR') =>
  MenuItemSnapshot.create({
    menuItemId: 'item-1',
    name: 'Margherita',
    basePrice: money(basePrice, currency),
    categoryId: 'cat-1',
  }).getValue();

const variant = (optionId: string, priceDelta: number, currency = 'INR') =>
  VariantSnapshot.create({
    optionId,
    label: optionId,
    priceDelta: money(priceDelta, currency),
  }).getValue();

describe('OrderRequestLine entity', () => {
  describe('create', () => {
    it('creates a line whose total matches (basePrice + Σ priceDelta) × quantity', () => {
      const result = OrderRequestLine.create({
        menuItem: menuItem(1000),
        selectedOptions: [variant('opt-large', 200), variant('opt-cheese', 50)],
        quantity: qty(3),
        lineTotal: money((1000 + 200 + 50) * 3), // 3750
      });

      expect(result.isSuccess).toBe(true);
      const line = result.getValue();
      expect(line.lineTotal.amount).toBe(3750);
      expect(line.selectedOptions).toHaveLength(2);
      expect(line.quantity.value).toBe(3);
    });

    it('creates a line with no selected options', () => {
      const result = OrderRequestLine.create({
        menuItem: menuItem(1000),
        selectedOptions: [],
        quantity: qty(2),
        lineTotal: money(2000),
      });
      expect(result.isSuccess).toBe(true);
    });

    it('rejects a lineTotal that does not reproduce from snapshot prices', () => {
      const result = OrderRequestLine.create({
        menuItem: menuItem(1000),
        selectedOptions: [variant('opt-large', 200)],
        quantity: qty(2),
        lineTotal: money(9999), // should be (1000 + 200) * 2 = 2400
      });
      expect(result.isFailure).toBe(true);
    });

    it('rejects a currency mismatch between base price and a variant delta', () => {
      const result = OrderRequestLine.create({
        menuItem: menuItem(1000, 'INR'),
        selectedOptions: [variant('opt-large', 200, 'USD')],
        quantity: qty(1),
        lineTotal: money(1200),
      });
      expect(result.isFailure).toBe(true);
    });

    it('rejects a non-MenuItemSnapshot menuItem', () => {
      const result = OrderRequestLine.create({
        menuItem: {} as never,
        selectedOptions: [],
        quantity: qty(1),
        lineTotal: money(1000),
      });
      expect(result.isFailure).toBe(true);
    });

    it('rejects a non-Quantity quantity', () => {
      const result = OrderRequestLine.create({
        menuItem: menuItem(1000),
        selectedOptions: [],
        quantity: 2 as never,
        lineTotal: money(2000),
      });
      expect(result.isFailure).toBe(true);
    });
  });

  describe('immutability', () => {
    it('returns a defensive copy of selectedOptions', () => {
      const line = OrderRequestLine.create({
        menuItem: menuItem(1000),
        selectedOptions: [variant('opt-large', 200)],
        quantity: qty(1),
        lineTotal: money(1200),
      }).getValue();

      line.selectedOptions.push(variant('opt-evil', 1));
      expect(line.selectedOptions).toHaveLength(1);
    });
  });
});
