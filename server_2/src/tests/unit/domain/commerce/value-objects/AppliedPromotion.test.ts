import { AppliedPromotion } from '../../../../../domain/commerce/value-objects/AppliedPromotion';
import { Money } from '../../../../../domain/shared/Money';
import { PROMOTION_KIND } from '../../../../../domain/commerce/enums/promotion-kind.enum';

const money = (amount: number, currency = 'INR') => Money.create(amount, currency).getValue();

describe('AppliedPromotion', () => {
  it('creates a valid promotion and normalizes the code', () => {
    const result = AppliedPromotion.create({
      code: ' save10 ',
      kind: PROMOTION_KIND.PERCENTAGE,
      discount: money(1000),
      sourceRef: 'coupon:SAVE10',
    });

    expect(result.isSuccess).toBe(true);
    const promo = result.getValue();
    expect(promo.code).toBe('SAVE10');
    expect(promo.kind).toBe(PROMOTION_KIND.PERCENTAGE);
    expect(promo.discount.amount).toBe(1000);
    expect(promo.sourceRef).toBe('coupon:SAVE10');
  });

  it('rejects an empty code', () => {
    const result = AppliedPromotion.create({
      code: '   ',
      kind: PROMOTION_KIND.FIXED,
      discount: money(1000),
      sourceRef: 'coupon:X',
    });
    expect(result.isFailure).toBe(true);
  });

  it('rejects an invalid kind', () => {
    const result = AppliedPromotion.create({
      code: 'X',
      kind: 'BOGUS' as never,
      discount: money(1000),
      sourceRef: 'coupon:X',
    });
    expect(result.isFailure).toBe(true);
  });

  it('rejects a non-Money discount', () => {
    const result = AppliedPromotion.create({
      code: 'X',
      kind: PROMOTION_KIND.FIXED,
      discount: 1000 as never,
      sourceRef: 'coupon:X',
    });
    expect(result.isFailure).toBe(true);
  });

  it('rejects an empty sourceRef', () => {
    const result = AppliedPromotion.create({
      code: 'X',
      kind: PROMOTION_KIND.FIXED,
      discount: money(1000),
      sourceRef: '',
    });
    expect(result.isFailure).toBe(true);
  });

  it('is equal by value', () => {
    const a = AppliedPromotion.create({ code: 'X', kind: PROMOTION_KIND.FIXED, discount: money(1000), sourceRef: 'r' }).getValue();
    const b = AppliedPromotion.create({ code: 'X', kind: PROMOTION_KIND.FIXED, discount: money(1000), sourceRef: 'r' }).getValue();
    expect(a.equals(b)).toBe(true);
  });
});
