import { Result } from '../../../shared/Result';
import { ValidationError } from '../../../shared/errors/ValidationError';
import { Money } from '../../../shared/Money';
import { AppliedPromotion } from '../../value-objects/AppliedPromotion';

export class PromotionStage {
  public static run(promotion: AppliedPromotion | undefined | null, subtotal: Money): Result<Money> {
    if (!(subtotal instanceof Money)) {
      return Result.fail<Money>(new ValidationError('Subtotal must be a valid Money value object'));
    }

    if (!promotion) {
      return Money.create(0, subtotal.currency);
    }

    if (!(promotion instanceof AppliedPromotion)) {
      return Result.fail<Money>(new ValidationError('Promotion must be a valid AppliedPromotion value object'));
    }

    const discount = promotion.discount;
    if (discount.currency !== subtotal.currency) {
      return Result.fail<Money>(
        new ValidationError(
          `Promotion discount currency ${discount.currency} does not match subtotal currency ${subtotal.currency}`
        )
      );
    }

    if (discount.amount > subtotal.amount) {
      return Result.fail<Money>(new ValidationError('Promotion discount cannot exceed the subtotal'));
    }

    return Result.ok<Money>(discount);
  }
}
