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

export class PricingCalculator implements IPricingCalculator {
  public calculate(ctx: PricingContext): Result<PricingBreakdown> {
    const subtotalResult = SubtotalStage.run(ctx.lines);
    if (subtotalResult.isFailure) return Result.fail<PricingBreakdown>(subtotalResult.getError());
    const subtotal = subtotalResult.getValue();

    const feesResult = FeeStage.run(ctx.restaurantFeeInputs);
    if (feesResult.isFailure) return Result.fail<PricingBreakdown>(feesResult.getError());
    const fees: Fee[] = [...feesResult.getValue()];

    const deliveryFeeResult = DeliveryFeeStage.run(ctx.deliveryInputs, subtotal);
    if (deliveryFeeResult.isFailure) return Result.fail<PricingBreakdown>(deliveryFeeResult.getError());
    fees.push(deliveryFeeResult.getValue());

    const discountResult = PromotionStage.run(ctx.promotion, subtotal);
    if (discountResult.isFailure) return Result.fail<PricingBreakdown>(discountResult.getError());
    const discount = discountResult.getValue();

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

    return TotalStage.run({ subtotal, fees, discount, tax: taxResult.getValue() });
  }
}
