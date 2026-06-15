import { Result } from '../../../shared/Result';
import { ValidationError } from '../../../shared/errors/ValidationError';
import { Money } from '../../../shared/Money';
import { AppliedPromotion } from '../../value-objects/AppliedPromotion';

// Pricing pipeline stage 4 (Commerce Phase 8, §4.2) — pure.
// Resolves the discount contribution from an already-validated AppliedPromotion.
//
// The promotion is resolved upstream by IPromotionService (cart-time apply / checkout
// recompute); this stage stays pure and only folds its discount into the pipeline. With
// no promotion it yields a zero discount in the subtotal's currency — preserving the
// Phase 7 reproducibility invariant. It guards currency match and ensures the discount
// can never exceed the subtotal (which would drive the total negative).
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
