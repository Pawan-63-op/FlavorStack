import { PromotionService } from '../../../../infrastructure/services/PromotionService';
import { Coupon } from '../../../../domain/commerce/value-objects/Coupon';
import { Money } from '../../../../domain/shared/Money';
import { PROMOTION_KIND } from '../../../../domain/commerce/enums/promotion-kind.enum';

const money = (amount: number, currency = 'INR') => Money.create(amount, currency).getValue();

const coupons = [
  Coupon.create({ code: 'SAVE10', kind: PROMOTION_KIND.PERCENTAGE, currency: 'INR', percentageOff: 10 }).getValue(),
  Coupon.create({
    code: 'FLAT50',
    kind: PROMOTION_KIND.FIXED,
    currency: 'INR',
    fixedAmountOff: money(5000),
    minOrderSubtotal: money(30000),
  }).getValue(),
];

describe('PromotionService', () => {
  let service: PromotionService;

  beforeEach(() => {
    service = new PromotionService(coupons);
  });

  it('validates a known code and computes the discount', () => {
    const result = service.validate('SAVE10', { subtotal: money(20000), currency: 'INR' });
    expect(result.isSuccess).toBe(true);
    expect(result.getValue().discount.amount).toBe(2000);
  });

  it('is case-insensitive on the code', () => {
    expect(service.validate('save10', { subtotal: money(20000), currency: 'INR' }).isSuccess).toBe(true);
  });

  it('fails for an unknown code', () => {
    expect(service.validate('NOPE', { subtotal: money(20000), currency: 'INR' }).isFailure).toBe(true);
  });

  it('fails an empty code', () => {
    expect(service.validate('  ', { subtotal: money(20000), currency: 'INR' }).isFailure).toBe(true);
  });

  it('propagates a min-order failure from the coupon', () => {
    expect(service.validate('FLAT50', { subtotal: money(10000), currency: 'INR' }).isFailure).toBe(true);
  });

  it('honours the min-order threshold on success', () => {
    expect(service.validate('FLAT50', { subtotal: money(40000), currency: 'INR' }).isSuccess).toBe(true);
  });
});
