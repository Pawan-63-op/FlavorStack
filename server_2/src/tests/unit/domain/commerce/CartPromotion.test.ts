import { Cart } from '../../../../domain/commerce/entities/Cart';
import { LineItemSelection } from '../../../../domain/commerce/value-objects/LineItemSelection';
import { AppliedPromotion } from '../../../../domain/commerce/value-objects/AppliedPromotion';
import { Money } from '../../../../domain/shared/Money';
import { PROMOTION_KIND } from '../../../../domain/commerce/enums/promotion-kind.enum';

const money = (amount: number, currency = 'INR') => Money.create(amount, currency).getValue();

function selection(overrides: Partial<{ menuItemId: string; selectedOptionIds: string[]; quantity: number }> = {}) {
  return LineItemSelection.create({ menuItemId: 'menu-1', selectedOptionIds: [], quantity: 1, ...overrides }).getValue();
}

const promo = (amount: number, currency = 'INR') =>
  AppliedPromotion.create({ code: 'SAVE', kind: PROMOTION_KIND.FIXED, discount: money(amount, currency), sourceRef: 'coupon:SAVE' }).getValue();

function cartWithItem(unit = 10000, qty = 2): Cart {
  const cart = Cart.create('customer-1').getValue();
  cart.addItem('restaurant-1', selection({ quantity: qty }), money(unit));
  cart.pullDomainEvents();
  return cart;
}

describe('Cart promotions (Phase 8)', () => {
  describe('calculateSubtotal', () => {
    it('folds line totals', () => {
      const cart = cartWithItem(10000, 2);
      expect(cart.calculateSubtotal().getValue().amount).toBe(20000);
    });

    it('fails on an empty cart', () => {
      const cart = Cart.create('customer-1').getValue();
      expect(cart.calculateSubtotal().isFailure).toBe(true);
    });
  });

  describe('applyPromotion', () => {
    it('attaches a validated promotion', () => {
      const cart = cartWithItem();
      const result = cart.applyPromotion(promo(2000));
      expect(result.isSuccess).toBe(true);
      expect(cart.appliedPromotion!.discount.amount).toBe(2000);
    });

    it('replaces an existing promotion (one per cart)', () => {
      const cart = cartWithItem();
      cart.applyPromotion(promo(2000));
      cart.applyPromotion(promo(3000));
      expect(cart.appliedPromotion!.discount.amount).toBe(3000);
    });

    it('fails on an empty cart', () => {
      const cart = Cart.create('customer-1').getValue();
      expect(cart.applyPromotion(promo(2000)).isFailure).toBe(true);
    });

    it('fails on a currency mismatch', () => {
      const cart = cartWithItem();
      expect(cart.applyPromotion(promo(2000, 'USD')).isFailure).toBe(true);
    });

    it('bumps the version', () => {
      const cart = cartWithItem();
      const before = cart.version;
      cart.applyPromotion(promo(2000));
      expect(cart.version).toBe(before + 1);
    });
  });

  describe('removePromotion', () => {
    it('clears the applied promotion', () => {
      const cart = cartWithItem();
      cart.applyPromotion(promo(2000));
      expect(cart.removePromotion().isSuccess).toBe(true);
      expect(cart.appliedPromotion).toBeNull();
    });

    it('fails when no promotion is applied', () => {
      const cart = cartWithItem();
      expect(cart.removePromotion().isFailure).toBe(true);
    });
  });

  describe('promotion invalidation on line changes', () => {
    it('drops the promotion when an item is added', () => {
      const cart = cartWithItem();
      cart.applyPromotion(promo(2000));
      cart.addItem('restaurant-1', selection({ menuItemId: 'menu-2' }), money(5000));
      expect(cart.appliedPromotion).toBeNull();
    });

    it('drops the promotion when the cart is cleared', () => {
      const cart = cartWithItem();
      cart.applyPromotion(promo(2000));
      cart.clear();
      expect(cart.appliedPromotion).toBeNull();
    });
  });
});
