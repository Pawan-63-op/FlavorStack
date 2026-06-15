import { Result } from '../../domain/shared/Result';
import { Fee } from '../../domain/commerce/value-objects/Fee';
import { PricingBreakdown } from '../../domain/commerce/value-objects/PricingBreakdown';
import { IPricingCalculator } from '../../domain/commerce/services/IPricingCalculator';
import { PricingContext } from '../../domain/commerce/types/PricingContext';
import { SubtotalStage } from '../../domain/commerce/services/pricing/SubtotalStage';
import { FeeStage } from '../../domain/commerce/services/pricing/FeeStage';
import { DeliveryFeeStage } from '../../domain/commerce/services/pricing/DeliveryFeeStage';
import { PromotionStage } from '../../domain/commerce/services/pricing/PromotionStage';
import { TaxStage } from '../../domain/commerce/services/pricing/TaxStage';
import { TotalStage } from '../../domain/commerce/services/pricing/TotalStage';

// Implements IPricingCalculator (Commerce Phase 7 + Phase 8) — ordered pipeline of pure stages
// over a PricingContext: SubtotalStage -> FeeStage -> DeliveryFeeStage -> PromotionStage ->
// TaxStage -> TotalStage. Integer Money discipline throughout; no I/O. The same PricingContext
// always yields an identical PricingBreakdown (reproducibility invariant).
//
// PromotionStage (Phase 8) folds the discount from ctx.promotion (an AppliedPromotion already
// resolved by IPromotionService); with no promotion it contributes a zero discount, so the
// Phase 7 behaviour is preserved exactly.
export class PricingCalculator implements IPricingCalculator {
  public calculate(ctx: PricingContext): Result<PricingBreakdown> {
    // 1. Subtotal
    const subtotalResult = SubtotalStage.run(ctx.lines);
    if (subtotalResult.isFailure) return Result.fail<PricingBreakdown>(subtotalResult.getError());
    const subtotal = subtotalResult.getValue();

    // 2. Restaurant fees (platform + packaging)
    const feesResult = FeeStage.run(ctx.restaurantFeeInputs);
    if (feesResult.isFailure) return Result.fail<PricingBreakdown>(feesResult.getError());
    const fees: Fee[] = [...feesResult.getValue()];

    // 3. Delivery fee
    const deliveryFeeResult = DeliveryFeeStage.run(ctx.deliveryInputs, subtotal);
    if (deliveryFeeResult.isFailure) return Result.fail<PricingBreakdown>(deliveryFeeResult.getError());
    fees.push(deliveryFeeResult.getValue());

    // 4. Promotion — discount from an already-validated AppliedPromotion (zero when absent).
    const discountResult = PromotionStage.run(ctx.promotion, subtotal);
    if (discountResult.isFailure) return Result.fail<PricingBreakdown>(discountResult.getError());
    const discount = discountResult.getValue();

    // 5. Tax — applied to the taxable base (subtotal + Σfees − discount).
    let taxableBase = subtotal;
    for (const fee of fees) {
      const addResult = taxableBase.add(fee.amount);
      if (addResult.isFailure) return Result.fail<PricingBreakdown>(addResult.getError());
      taxableBase = addResult.getValue();
    }
    const baseAfterDiscount = taxableBase.subtract(discount);
    if (baseAfterDiscount.isFailure) return Result.fail<PricingBreakdown>(baseAfterDiscount.getError());

    const taxResult = TaxStage.run(baseAfterDiscount.getValue(), ctx.taxPolicy);
    if (taxResult.isFailure) return Result.fail<PricingBreakdown>(taxResult.getError());

    // 6. Total — assembled + invariant-checked.
    return TotalStage.run({ subtotal, fees, discount, tax: taxResult.getValue() });
  }
}
