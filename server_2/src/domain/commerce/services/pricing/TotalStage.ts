import { Result } from '../../../shared/Result';
import { Money } from '../../../shared/Money';
import { Fee } from '../../value-objects/Fee';
import { PricingBreakdown } from '../../value-objects/PricingBreakdown';

export class TotalStage {
  public static run(props: {
    subtotal: Money;
    fees: Fee[];
    discount: Money;
    tax: Money;
  }): Result<PricingBreakdown> {
    let runningTotal = props.subtotal;

    for (const fee of props.fees) {
      const addFeeResult = runningTotal.add(fee.amount);
      if (addFeeResult.isFailure) return Result.fail<PricingBreakdown>(addFeeResult.getError());
      runningTotal = addFeeResult.getValue();
    }

    const withTaxResult = runningTotal.add(props.tax);
    if (withTaxResult.isFailure) return Result.fail<PricingBreakdown>(withTaxResult.getError());

    const totalResult = withTaxResult.getValue().subtract(props.discount);
    if (totalResult.isFailure) return Result.fail<PricingBreakdown>(totalResult.getError());

    return PricingBreakdown.create({
      subtotal: props.subtotal,
      fees: props.fees,
      discount: props.discount,
      tax: props.tax,
      total: totalResult.getValue(),
    });
  }
}
