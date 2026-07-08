import { Result } from '../../domain/shared/Result';
import { ValidationError } from '../../domain/shared/errors/ValidationError';
import { NotFoundError } from '../../domain/shared/errors/NotFoundError';
import { AppliedPromotion } from '../../domain/commerce/value-objects/AppliedPromotion';
import { Coupon } from '../../domain/commerce/value-objects/Coupon';
import { IPromotionService, PromotionContext } from '../../domain/commerce/services/IPromotionService';

export class PromotionService implements IPromotionService {
  private readonly couponsByCode: Map<string, Coupon>;

  constructor(coupons: Coupon[] = []) {
    this.couponsByCode = new Map(coupons.map((coupon) => [coupon.code, coupon]));
  }

  validate(code: string, ctx: PromotionContext): Result<AppliedPromotion> {
    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return Result.fail<AppliedPromotion>(new ValidationError('Promotion code must be a non-empty string'));
    }

    const normalized = code.trim().toUpperCase();
    const coupon = this.couponsByCode.get(normalized);
    if (!coupon) {
      return Result.fail<AppliedPromotion>(new NotFoundError(`Promotion code not found: ${normalized}`));
    }

    return coupon.apply(ctx.subtotal);
  }
}
