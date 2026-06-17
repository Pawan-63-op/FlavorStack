import { PricingBreakdown } from '../../../../../domain/commerce/value-objects/PricingBreakdown';
import { Fee } from '../../../../../domain/commerce/value-objects/Fee';
import { Money } from '../../../../../domain/shared/Money';
import { FEE_TYPE } from '../../../../../domain/commerce/enums/fee-type.enum';
import { ValidationError } from '../../../../../domain/shared/errors/ValidationError';

function money(amount: number, currency = 'INR') {
  return Money.create(amount, currency).getValue();
}

function fee(type: keyof typeof FEE_TYPE, amount: number, currency = 'INR') {
  return Fee.create({ type: FEE_TYPE[type], amount: money(amount, currency) }).getValue();
}

describe('PricingBreakdown value object', () => {
  describe('create', () => {
    it('creates a valid breakdown when total equals subtotal + fees - discount + tax', () => {
      const result = PricingBreakdown.create({
        subtotal: money(1000),
        fees: [fee('PLATFORM', 50), fee('PACKAGING', 20)],
        discount: money(0),
        tax: money(100),
        total: money(1170),
      });

      expect(result.isSuccess).toBe(true);
      const breakdown = result.getValue();
      expect(breakdown.subtotal.amount).toBe(1000);
      expect(breakdown.fees).toHaveLength(2);
      expect(breakdown.discount.amount).toBe(0);
      expect(breakdown.tax.amount).toBe(100);
      expect(breakdown.total.amount).toBe(1170);
    });

    it('creates a valid breakdown with no fees, discount, or tax', () => {
      const result = PricingBreakdown.create({
        subtotal: money(500),
        fees: [],
        discount: money(0),
        tax: money(0),
        total: money(500),
      });

      expect(result.isSuccess).toBe(true);
    });

    it('accounts for a non-zero discount', () => {
      const result = PricingBreakdown.create({
        subtotal: money(1000),
        fees: [fee('DELIVERY', 40)],
        discount: money(100),
        tax: money(50),
        total: money(990), // 1000 + 40 - 100 + 50
      });

      expect(result.isSuccess).toBe(true);
    });

    it('rejects a total that does not match subtotal + fees - discount + tax', () => {
      const result = PricingBreakdown.create({
        subtotal: money(1000),
        fees: [],
        discount: money(0),
        tax: money(0),
        total: money(999),
      });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('rejects mismatched currencies between subtotal and a fee', () => {
      const result = PricingBreakdown.create({
        subtotal: money(1000, 'INR'),
        fees: [fee('PLATFORM', 50, 'USD')],
        discount: money(0, 'INR'),
        tax: money(0, 'INR'),
        total: money(1050, 'INR'),
      });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('rejects a discount larger than subtotal + fees + tax', () => {
      const result = PricingBreakdown.create({
        subtotal: money(100),
        fees: [],
        discount: money(200),
        tax: money(0),
        total: money(0),
      });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('rejects a fees array containing a non-Fee value', () => {
      const result = PricingBreakdown.create({
        subtotal: money(1000),
        fees: [{ type: FEE_TYPE.PLATFORM, amount: money(50) } as any],
        discount: money(0),
        tax: money(0),
        total: money(1050),
      });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('rejects a non-Money subtotal', () => {
      const result = PricingBreakdown.create({
        subtotal: 1000 as any,
        fees: [],
        discount: money(0),
        tax: money(0),
        total: money(1000),
      });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });
  });

  describe('equals', () => {
    it('treats two breakdowns with the same values as equal', () => {
      const build = () =>
        PricingBreakdown.create({
          subtotal: money(1000),
          fees: [fee('PLATFORM', 50)],
          discount: money(0),
          tax: money(0),
          total: money(1050),
        }).getValue();

      expect(build().equals(build())).toBe(true);
    });
  });
});
