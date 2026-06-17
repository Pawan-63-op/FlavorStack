import { PricingCalculator } from '../../../../infrastructure/services/PricingCalculator';
import { Money } from '../../../../domain/shared/Money';
import { Quantity } from '../../../../domain/commerce/value-objects/Quantity';
import { FEE_TYPE } from '../../../../domain/commerce/enums/fee-type.enum';
import { PricingContext } from '../../../../domain/commerce/types/PricingContext';

const money = (amount: number) => Money.create(amount, 'INR').getValue();
const qty = (value: number) => Quantity.create(value).getValue();

const baseContext = (overrides: Partial<PricingContext> = {}): PricingContext => ({
  lines: [
    {
      menuItemId: 'item-1',
      basePrice: money(10000),
      selectedVariants: [{ optionId: 'large', priceDelta: money(2000) }],
      quantity: qty(2),
    },
  ],
  restaurantFeeInputs: { platformFee: money(3000), packagingFee: money(1000) },
  deliveryInputs: {
    distanceMeters: 3000,
    feeTiers: [
      { maxDistanceMeters: 2000, fee: money(2000) },
      { maxDistanceMeters: 5000, fee: money(4000) },
    ],
  },
  taxPolicy: { rate: 0.05 },
  ...overrides,
});

describe('PricingCalculator (full pipeline)', () => {
  const calculator = new PricingCalculator();

  it('produces an invariant-satisfying breakdown for a multi-component cart', () => {
    const result = calculator.calculate(baseContext());

    expect(result.isSuccess).toBe(true);
    const b = result.getValue();

    // subtotal = (10000 + 2000) * 2 = 24000
    expect(b.subtotal.amount).toBe(24000);
    // fees = platform 3000 + packaging 1000 + delivery 4000 (3000m -> 5000m tier)
    const sumFees = b.fees.reduce((acc, f) => acc + f.amount.amount, 0);
    expect(sumFees).toBe(8000);
    expect(b.fees.map((f) => f.type)).toEqual([FEE_TYPE.PLATFORM, FEE_TYPE.PACKAGING, FEE_TYPE.DELIVERY]);
    // discount = 0 (Phase 8 placeholder)
    expect(b.discount.amount).toBe(0);
    // taxable base = 24000 + 8000 - 0 = 32000; tax = 32000 * 0.05 = 1600
    expect(b.tax.amount).toBe(1600);
    // total = 24000 + 8000 - 0 + 1600 = 33600
    expect(b.total.amount).toBe(33600);
  });

  it('is reproducible — the same context yields an identical breakdown', () => {
    const ctx = baseContext();
    const first = calculator.calculate(ctx).getValue();
    const second = calculator.calculate(ctx).getValue();

    expect(first.equals(second)).toBe(true);
    expect(first.total.amount).toBe(second.total.amount);
  });

  it('handles zero fees, zero delivery, and zero tax', () => {
    const result = calculator.calculate(
      baseContext({
        restaurantFeeInputs: { platformFee: money(0), packagingFee: money(0) },
        deliveryInputs: {
          distanceMeters: 1000,
          feeTiers: [{ maxDistanceMeters: 5000, fee: money(0) }],
        },
        taxPolicy: { rate: 0 },
      })
    );

    const b = result.getValue();
    expect(b.tax.amount).toBe(0);
    expect(b.total.amount).toBe(b.subtotal.amount);
  });

  it('applies the free-delivery threshold across the whole pipeline', () => {
    const result = calculator.calculate(
      baseContext({
        deliveryInputs: {
          distanceMeters: 3000,
          feeTiers: [{ maxDistanceMeters: 5000, fee: money(4000) }],
          freeAboveSubtotal: money(24000),
        },
        taxPolicy: { rate: 0 },
      })
    );

    const b = result.getValue();
    const delivery = b.fees.find((f) => f.type === FEE_TYPE.DELIVERY);
    expect(delivery!.amount.amount).toBe(0); // subtotal 24000 meets threshold
  });

  it('propagates an upstream stage failure (empty lines)', () => {
    const result = calculator.calculate(baseContext({ lines: [] }));

    expect(result.isFailure).toBe(true);
  });

  it('propagates a currency mismatch from the lines', () => {
    const result = calculator.calculate(
      baseContext({
        lines: [
          {
            menuItemId: 'item-1',
            basePrice: Money.create(10000, 'USD').getValue(),
            selectedVariants: [],
            quantity: qty(1),
          },
        ],
      })
    );

    // subtotal currency USD, but fee inputs are INR -> taxable base add fails
    expect(result.isFailure).toBe(true);
  });
});
