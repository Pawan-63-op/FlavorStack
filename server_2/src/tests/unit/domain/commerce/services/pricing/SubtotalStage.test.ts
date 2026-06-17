import { SubtotalStage } from '../../../../../../domain/commerce/services/pricing/SubtotalStage';
import { Money } from '../../../../../../domain/shared/Money';
import { Quantity } from '../../../../../../domain/commerce/value-objects/Quantity';
import { ValidationError } from '../../../../../../domain/shared/errors/ValidationError';
import { PricingLineInput } from '../../../../../../domain/commerce/types/PricingContext';

const money = (amount: number) => Money.create(amount, 'INR').getValue();
const qty = (value: number) => Quantity.create(value).getValue();

const line = (overrides: Partial<PricingLineInput>): PricingLineInput => ({
  menuItemId: 'item-1',
  basePrice: money(10000),
  selectedVariants: [],
  quantity: qty(1),
  ...overrides,
});

describe('SubtotalStage', () => {
  it('computes a single line with no variants', () => {
    const result = SubtotalStage.run([line({ basePrice: money(10000), quantity: qty(1) })]);

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().amount).toBe(10000);
  });

  it('applies quantity as a multiplier', () => {
    const result = SubtotalStage.run([line({ basePrice: money(10000), quantity: qty(3) })]);

    expect(result.getValue().amount).toBe(30000);
  });

  it('adds a single variant priceDelta to the base price', () => {
    const result = SubtotalStage.run([
      line({
        basePrice: money(10000),
        selectedVariants: [{ optionId: 'large', priceDelta: money(2000) }],
        quantity: qty(1),
      }),
    ]);

    expect(result.getValue().amount).toBe(12000);
  });

  it('sums multiple variant priceDeltas before multiplying by quantity', () => {
    const result = SubtotalStage.run([
      line({
        basePrice: money(10000),
        selectedVariants: [
          { optionId: 'large', priceDelta: money(2000) },
          { optionId: 'extra-cheese', priceDelta: money(1500) },
        ],
        quantity: qty(2),
      }),
    ]);

    // (10000 + 2000 + 1500) * 2 = 27000
    expect(result.getValue().amount).toBe(27000);
  });

  it('sums multiple lines with mixed quantities and variants', () => {
    const result = SubtotalStage.run([
      line({ basePrice: money(10000), quantity: qty(2) }), // 20000
      line({
        basePrice: money(5000),
        selectedVariants: [{ optionId: 'spicy', priceDelta: money(500) }],
        quantity: qty(3),
      }), // (5500)*3 = 16500
    ]);

    expect(result.getValue().amount).toBe(36500);
  });

  it('fails on an empty line list', () => {
    const result = SubtotalStage.run([]);

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });

  it('fails when a variant priceDelta is a different currency', () => {
    const result = SubtotalStage.run([
      line({
        basePrice: Money.create(10000, 'INR').getValue(),
        selectedVariants: [{ optionId: 'x', priceDelta: Money.create(1000, 'USD').getValue() }],
      }),
    ]);

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });

  it('fails when lines span different currencies', () => {
    const result = SubtotalStage.run([
      line({ basePrice: Money.create(10000, 'INR').getValue() }),
      line({ basePrice: Money.create(5000, 'USD').getValue() }),
    ]);

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });
});
