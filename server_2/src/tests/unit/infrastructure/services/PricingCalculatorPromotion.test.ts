import { PricingCalculator } from '../../../../infrastructure/services/PricingCalculator';
import { Money } from '../../../../domain/shared/Money';
import { Quantity } from '../../../../domain/commerce/value-objects/Quantity';
import { PricingContext } from '../../../../domain/commerce/types/PricingContext';
import { AppliedPromotion } from '../../../../domain/commerce/value-objects/AppliedPromotion';
import { PROMOTION_KIND } from '../../../../domain/commerce/enums/promotion-kind.enum';

const money = (amount: number) => Money.create(amount, 'INR').getValue();
const qty = (value: number) => Quantity.create(value).getValue();
const promo = (amount: number) =>
  AppliedPromotion.create({ code: 'SAVE', kind: PROMOTION_KIND.FIXED, discount: money(amount), sourceRef: 'r' }).getValue();

const baseContext = (overrides: Partial<PricingContext> = {}): PricingContext => ({
  lines: [
    { menuItemId: 'item-1', basePrice: money(10000), selectedVariants: [{ optionId: 'large', priceDelta: money(2000) }], quantity: qty(2) },
  ],
  restaurantFeeInputs: { platformFee: money(3000), packagingFee: money(1000) },
  deliveryInputs: { distanceMeters: 3000, feeTiers: [{ maxDistanceMeters: 5000, fee: money(4000) }] },
  taxPolicy: { rate: 0.05 },
  ...overrides,
});

describe('PricingCalculator + promotion (Phase 8)', () => {
  const calculator = new PricingCalculator();

  it('folds the promotion discount into the breakdown', () => {
    // subtotal 24000, fees 8000, discount 4000 -> taxable base 28000, tax 1400, total 29400
    const result = calculator.calculate(baseContext({ promotion: promo(4000) }));
    expect(result.isSuccess).toBe(true);
    const b = result.getValue();
    expect(b.discount.amount).toBe(4000);
    expect(b.tax.amount).toBe(1400);
    expect(b.total.amount).toBe(29400);
  });

  it('keeps discount zero when no promotion is supplied', () => {
    const b = calculator.calculate(baseContext()).getValue();
    expect(b.discount.amount).toBe(0);
  });
});
