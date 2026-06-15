import { Coupon } from '../../domain/commerce/value-objects/Coupon';
import { Money } from '../../domain/shared/Money';
import { Result } from '../../domain/shared/Result';
import { PROMOTION_KIND } from '../../domain/commerce/enums/promotion-kind.enum';

// Interim, in-memory coupon catalog for the Commerce promotion engine (Phase 8).
//
// This is deliberately a hard-coded seed: it stands in for the catalog a future
// Promotions context will own. PromotionService reads it through Coupon VOs only,
// so swapping this for a real repository later touches nothing else.
//
// Construction failures here would be a programming error in the seed, not a runtime
// domain failure, so we throw fast rather than thread Result through composition.
function ok<T>(label: string, value: Result<T>): T {
  if (value.isFailure) {
    const err = value.getError();
    throw new Error(`Invalid seed coupon (${label}): ${typeof err === 'string' ? err : err.message}`);
  }
  return value.getValue();
}

export function buildDefaultCommerceCoupons(currency = 'INR'): Coupon[] {
  const money = (amount: number) => ok(`money:${amount}`, Money.create(amount, currency));

  return [
    // 10% off, no minimum, capped at ₹100.
    ok(
      'SAVE10',
      Coupon.create({
        code: 'SAVE10',
        kind: PROMOTION_KIND.PERCENTAGE,
        currency,
        percentageOff: 10,
        maxDiscount: money(10000),
      })
    ),
    // ₹50 flat off on orders of ₹300+.
    ok(
      'FLAT50',
      Coupon.create({
        code: 'FLAT50',
        kind: PROMOTION_KIND.FIXED,
        currency,
        fixedAmountOff: money(5000),
        minOrderSubtotal: money(30000),
      })
    ),
    // 20% off on orders of ₹500+, capped at ₹150.
    ok(
      'WELCOME20',
      Coupon.create({
        code: 'WELCOME20',
        kind: PROMOTION_KIND.PERCENTAGE,
        currency,
        percentageOff: 20,
        minOrderSubtotal: money(50000),
        maxDiscount: money(15000),
      })
    ),
  ];
}
