import { PromotionStage } from '../../../../../../domain/commerce/services/pricing/PromotionStage';
import { AppliedPromotion } from '../../../../../../domain/commerce/value-objects/AppliedPromotion';
import { Money } from '../../../../../../domain/shared/Money';
import { PROMOTION_KIND } from '../../../../../../domain/commerce/enums/promotion-kind.enum';

const money = (amount: number, currency = 'INR') => Money.create(amount, currency).getValue();
const promo = (amount: number, currency = 'INR') =>
  AppliedPromotion.create({ code: 'X', kind: PROMOTION_KIND.FIXED, discount: money(amount, currency), sourceRef: 'r' }).getValue();

describe('PromotionStage', () => {
  it('returns a zero discount when there is no promotion', () => {
    const result = PromotionStage.run(undefined, money(20000));
    expect(result.isSuccess).toBe(true);
    expect(result.getValue().amount).toBe(0);
    expect(result.getValue().currency).toBe('INR');
  });

  it('returns zero discount for null promotion', () => {
    expect(PromotionStage.run(null, money(20000)).getValue().amount).toBe(0);
  });

  it('returns the promotion discount', () => {
    const result = PromotionStage.run(promo(3000), money(20000));
    expect(result.getValue().amount).toBe(3000);
  });

  it('fails when the discount currency does not match the subtotal', () => {
    expect(PromotionStage.run(promo(3000, 'USD'), money(20000, 'INR')).isFailure).toBe(true);
  });

  it('fails when the discount exceeds the subtotal', () => {
    expect(PromotionStage.run(promo(30000), money(20000)).isFailure).toBe(true);
  });

  it('allows a discount equal to the subtotal', () => {
    expect(PromotionStage.run(promo(20000), money(20000)).isSuccess).toBe(true);
  });
});
