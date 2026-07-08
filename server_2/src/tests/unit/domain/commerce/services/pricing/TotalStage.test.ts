import { TotalStage } from '../../../../../../domain/commerce/services/pricing/TotalStage';
import { Money } from '../../../../../../domain/shared/Money';
import { Fee } from '../../../../../../domain/commerce/value-objects/Fee';
import { FEE_TYPE } from '../../../../../../domain/commerce/enums/fee-type.enum';
import { PricingBreakdown } from '../../../../../../domain/commerce/value-objects/PricingBreakdown';

const money = (amount: number) => Money.create(amount, 'INR').getValue();
const fee = (type: any, amount: number) => Fee.create({ type, amount: money(amount) }).getValue();

describe('TotalStage', () => {
  it('assembles a breakdown with the invariant-satisfying total', () => {
    const result = TotalStage.run({
      subtotal: money(20000),
      fees: [fee(FEE_TYPE.PLATFORM, 5000), fee(FEE_TYPE.DELIVERY, 3000)],
      discount: money(0),
      tax: money(1400),
    });

    expect(result.isSuccess).toBe(true);
    const breakdown = result.getValue();
    expect(breakdown).toBeInstanceOf(PricingBreakdown);
    expect(breakdown.total.amount).toBe(29400);
  });

  it('handles zero fees and zero tax', () => {
    const result = TotalStage.run({
      subtotal: money(20000),
      fees: [],
      discount: money(0),
      tax: money(0),
    });

    expect(result.getValue().total.amount).toBe(20000);
  });

  it('subtracts a non-zero discount', () => {
    const result = TotalStage.run({
      subtotal: money(20000),
      fees: [fee(FEE_TYPE.PLATFORM, 5000)],
      discount: money(2000),
      tax: money(0),
    });

    expect(result.getValue().total.amount).toBe(23000);
  });

  it('fails on a currency mismatch among components', () => {
    const result = TotalStage.run({
      subtotal: Money.create(20000, 'INR').getValue(),
      fees: [Fee.create({ type: FEE_TYPE.PLATFORM, amount: Money.create(5000, 'USD').getValue() }).getValue()],
      discount: Money.create(0, 'INR').getValue(),
      tax: Money.create(0, 'INR').getValue(),
    });

    expect(result.isFailure).toBe(true);
  });

  it('fails when discount exceeds subtotal + fees + tax (negative total)', () => {
    const result = TotalStage.run({
      subtotal: money(20000),
      fees: [],
      discount: money(25000),
      tax: money(0),
    });

    expect(result.isFailure).toBe(true);
  });
});
