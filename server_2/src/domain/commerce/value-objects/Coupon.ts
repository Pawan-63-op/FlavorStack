import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { ValidationError } from '../../shared/errors/ValidationError';
import { Money } from '../../shared/Money';
import { PROMOTION_KIND, PromotionKind } from '../enums/promotion-kind.enum';
import { AppliedPromotion } from './AppliedPromotion';

// Interim promotion-catalog entry for the Commerce promotion engine (Phase 8).
//
// A Coupon carries the eligibility rules (kind, value, min-order, currency, optional cap)
// and knows how to turn an eligible subtotal into an AppliedPromotion. It lives behind
// IPromotionService so the whole concept — coupon + applied result — can be lifted into a
// future Promotions context with no Commerce rewrite.
//
// Money discipline: discounts are integer minor units. A percentage discount rounds via
// Money.multiply; every discount is capped so it can never exceed the subtotal (no negative
// totals downstream) nor an optional maxDiscount cap.
interface CouponProps {
  code: string;
  kind: PromotionKind;
  // PERCENTAGE: percentageOff in (0, 100]. FIXED: ignored.
  percentageOff: number | null;
  // FIXED: the flat amount off. PERCENTAGE: ignored.
  fixedAmountOff: Money | null;
  // Minimum eligible subtotal; null = no minimum.
  minOrderSubtotal: Money | null;
  // Optional cap on the computed discount (PERCENTAGE coupons especially); null = uncapped.
  maxDiscount: Money | null;
  currency: string;
}

export class Coupon extends ValueObject<CouponProps> {
  private constructor(props: CouponProps) {
    super(props);
  }

  get code(): string {
    return this.props.code;
  }

  get kind(): PromotionKind {
    return this.props.kind;
  }

  get currency(): string {
    return this.props.currency;
  }

  public static create(props: {
    code: string;
    kind: PromotionKind;
    currency: string;
    percentageOff?: number | null;
    fixedAmountOff?: Money | null;
    minOrderSubtotal?: Money | null;
    maxDiscount?: Money | null;
  }): Result<Coupon> {
    if (!props.code || typeof props.code !== 'string' || props.code.trim().length === 0) {
      return Result.fail<Coupon>(new ValidationError('Coupon code must be a non-empty string'));
    }

    const validKinds = Object.values(PROMOTION_KIND) as string[];
    if (!validKinds.includes(props.kind)) {
      return Result.fail<Coupon>(new ValidationError(`Coupon kind must be one of: ${validKinds.join(', ')}`));
    }

    if (!props.currency || typeof props.currency !== 'string') {
      return Result.fail<Coupon>(new ValidationError('Coupon currency must be a non-empty string'));
    }
    const currency = props.currency.toUpperCase();

    if (props.kind === PROMOTION_KIND.PERCENTAGE) {
      const pct = props.percentageOff;
      if (typeof pct !== 'number' || isNaN(pct) || pct <= 0 || pct > 100) {
        return Result.fail<Coupon>(new ValidationError('Percentage coupon requires percentageOff in (0, 100]'));
      }
    } else {
      // FIXED
      if (!(props.fixedAmountOff instanceof Money)) {
        return Result.fail<Coupon>(new ValidationError('Fixed coupon requires a Money fixedAmountOff'));
      }
      if (props.fixedAmountOff.currency !== currency) {
        return Result.fail<Coupon>(new ValidationError('Coupon fixedAmountOff currency must match coupon currency'));
      }
    }

    for (const [name, money] of [
      ['minOrderSubtotal', props.minOrderSubtotal],
      ['maxDiscount', props.maxDiscount],
    ] as const) {
      if (money != null) {
        if (!(money instanceof Money)) {
          return Result.fail<Coupon>(new ValidationError(`Coupon ${name} must be a valid Money value object`));
        }
        if (money.currency !== currency) {
          return Result.fail<Coupon>(new ValidationError(`Coupon ${name} currency must match coupon currency`));
        }
      }
    }

    return Result.ok<Coupon>(
      new Coupon({
        code: props.code.trim().toUpperCase(),
        kind: props.kind,
        currency,
        percentageOff: props.percentageOff ?? null,
        fixedAmountOff: props.fixedAmountOff ?? null,
        minOrderSubtotal: props.minOrderSubtotal ?? null,
        maxDiscount: props.maxDiscount ?? null,
      })
    );
  }

  /**
   * Apply this coupon to an eligible subtotal, producing an AppliedPromotion.
   * Enforces currency match and the min-order precondition, computes the discount,
   * then caps it at maxDiscount and at the subtotal itself.
   */
  public apply(subtotal: Money): Result<AppliedPromotion> {
    if (!(subtotal instanceof Money)) {
      return Result.fail<AppliedPromotion>(new ValidationError('Subtotal must be a valid Money value object'));
    }
    if (subtotal.currency !== this.props.currency) {
      return Result.fail<AppliedPromotion>(
        new ValidationError(`Coupon ${this.props.code} is in ${this.props.currency}, cart is in ${subtotal.currency}`)
      );
    }

    if (this.props.minOrderSubtotal && subtotal.amount < this.props.minOrderSubtotal.amount) {
      return Result.fail<AppliedPromotion>(
        new ValidationError(
          `Coupon ${this.props.code} requires a minimum subtotal of ${this.props.minOrderSubtotal.amount} ${this.props.currency}`
        )
      );
    }

    let discountAmount: number;
    if (this.props.kind === PROMOTION_KIND.PERCENTAGE) {
      discountAmount = subtotal.multiply((this.props.percentageOff as number) / 100).amount;
    } else {
      discountAmount = (this.props.fixedAmountOff as Money).amount;
    }

    // Cap at maxDiscount, then never let the discount exceed the subtotal.
    if (this.props.maxDiscount) {
      discountAmount = Math.min(discountAmount, this.props.maxDiscount.amount);
    }
    discountAmount = Math.min(discountAmount, subtotal.amount);

    const discountResult = Money.create(discountAmount, this.props.currency);
    if (discountResult.isFailure) return Result.fail<AppliedPromotion>(discountResult.getError());

    return AppliedPromotion.create({
      code: this.props.code,
      kind: this.props.kind,
      discount: discountResult.getValue(),
      sourceRef: `coupon:${this.props.code}`,
    });
  }
}
