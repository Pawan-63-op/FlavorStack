import { Coupon } from '../../../../../domain/commerce/value-objects/Coupon';
import { Money } from '../../../../../domain/shared/Money';
import { PROMOTION_KIND } from '../../../../../domain/commerce/enums/promotion-kind.enum';

const money = (amount: number, currency = 'INR') => Money.create(amount, currency).getValue();

describe('Coupon', () => {
  describe('create', () => {
    it('builds a percentage coupon and uppercases the code', () => {
      const result = Coupon.create({ code: 'save10', kind: PROMOTION_KIND.PERCENTAGE, currency: 'INR', percentageOff: 10 });
      expect(result.isSuccess).toBe(true);
      expect(result.getValue().code).toBe('SAVE10');
    });

    it('rejects a percentage coupon with out-of-range percentageOff', () => {
      expect(Coupon.create({ code: 'X', kind: PROMOTION_KIND.PERCENTAGE, currency: 'INR', percentageOff: 0 }).isFailure).toBe(true);
      expect(Coupon.create({ code: 'X', kind: PROMOTION_KIND.PERCENTAGE, currency: 'INR', percentageOff: 150 }).isFailure).toBe(true);
    });

    it('rejects a fixed coupon without a Money fixedAmountOff', () => {
      expect(Coupon.create({ code: 'X', kind: PROMOTION_KIND.FIXED, currency: 'INR' }).isFailure).toBe(true);
    });

    it('rejects a coupon whose money inputs mismatch the coupon currency', () => {
      expect(
        Coupon.create({ code: 'X', kind: PROMOTION_KIND.FIXED, currency: 'INR', fixedAmountOff: money(100, 'USD') }).isFailure
      ).toBe(true);
    });
  });

  describe('apply', () => {
    it('computes a percentage discount', () => {
      const coupon = Coupon.create({ code: 'SAVE10', kind: PROMOTION_KIND.PERCENTAGE, currency: 'INR', percentageOff: 10 }).getValue();
      const result = coupon.apply(money(20000));
      expect(result.isSuccess).toBe(true);
      expect(result.getValue().discount.amount).toBe(2000);
      expect(result.getValue().code).toBe('SAVE10');
    });

    it('caps a percentage discount at maxDiscount', () => {
      const coupon = Coupon.create({
        code: 'SAVE10',
        kind: PROMOTION_KIND.PERCENTAGE,
        currency: 'INR',
        percentageOff: 10,
        maxDiscount: money(1000),
      }).getValue();
      const result = coupon.apply(money(100000)); // 10% = 10000, capped at 1000
      expect(result.getValue().discount.amount).toBe(1000);
    });

    it('computes a fixed discount', () => {
      const coupon = Coupon.create({ code: 'FLAT50', kind: PROMOTION_KIND.FIXED, currency: 'INR', fixedAmountOff: money(5000) }).getValue();
      const result = coupon.apply(money(30000));
      expect(result.getValue().discount.amount).toBe(5000);
    });

    it('never lets the discount exceed the subtotal', () => {
      const coupon = Coupon.create({ code: 'FLAT', kind: PROMOTION_KIND.FIXED, currency: 'INR', fixedAmountOff: money(50000) }).getValue();
      const result = coupon.apply(money(20000));
      expect(result.getValue().discount.amount).toBe(20000);
    });

    it('fails when subtotal is below the min-order threshold', () => {
      const coupon = Coupon.create({
        code: 'FLAT50',
        kind: PROMOTION_KIND.FIXED,
        currency: 'INR',
        fixedAmountOff: money(5000),
        minOrderSubtotal: money(30000),
      }).getValue();
      expect(coupon.apply(money(29999)).isFailure).toBe(true);
    });

    it('passes exactly at the min-order threshold', () => {
      const coupon = Coupon.create({
        code: 'FLAT50',
        kind: PROMOTION_KIND.FIXED,
        currency: 'INR',
        fixedAmountOff: money(5000),
        minOrderSubtotal: money(30000),
      }).getValue();
      expect(coupon.apply(money(30000)).isSuccess).toBe(true);
    });

    it('fails on a currency mismatch', () => {
      const coupon = Coupon.create({ code: 'X', kind: PROMOTION_KIND.PERCENTAGE, currency: 'INR', percentageOff: 10 }).getValue();
      expect(coupon.apply(money(10000, 'USD')).isFailure).toBe(true);
    });
  });
});
