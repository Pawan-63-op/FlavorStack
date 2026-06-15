import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { ValidationError } from '../../shared/errors/ValidationError';
import { Money } from '../../shared/Money';
import { Fee } from './Fee';

interface PricingBreakdownProps {
  subtotal: Money;
  fees: Fee[];
  discount: Money;
  tax: Money;
  total: Money;
}

export class PricingBreakdown extends ValueObject<PricingBreakdownProps> {
  private constructor(props: PricingBreakdownProps) {
    super(props);
  }

  get subtotal(): Money {
    return this.props.subtotal;
  }

  get fees(): Fee[] {
    return [...this.props.fees];
  }

  get discount(): Money {
    return this.props.discount;
  }

  get tax(): Money {
    return this.props.tax;
  }

  get total(): Money {
    return this.props.total;
  }

  /**
   * Enforces the reproducibility invariant: total == subtotal + Σfees − discount + tax,
   * with every component sharing one currency (Money.add/subtract reject mismatches).
   */
  public static create(props: {
    subtotal: Money;
    fees: Fee[];
    discount: Money;
    tax: Money;
    total: Money;
  }): Result<PricingBreakdown> {
    if (!(props.subtotal instanceof Money)) {
      return Result.fail<PricingBreakdown>(new ValidationError('Subtotal must be a valid Money value object'));
    }

    if (!Array.isArray(props.fees) || props.fees.some((fee) => !(fee instanceof Fee))) {
      return Result.fail<PricingBreakdown>(new ValidationError('Fees must be an array of Fee value objects'));
    }

    if (!(props.discount instanceof Money)) {
      return Result.fail<PricingBreakdown>(new ValidationError('Discount must be a valid Money value object'));
    }

    if (!(props.tax instanceof Money)) {
      return Result.fail<PricingBreakdown>(new ValidationError('Tax must be a valid Money value object'));
    }

    if (!(props.total instanceof Money)) {
      return Result.fail<PricingBreakdown>(new ValidationError('Total must be a valid Money value object'));
    }

    let runningTotal = props.subtotal;
    for (const fee of props.fees) {
      const addFeeResult = runningTotal.add(fee.amount);
      if (addFeeResult.isFailure) return Result.fail<PricingBreakdown>(addFeeResult.getError());
      runningTotal = addFeeResult.getValue();
    }

    const withTaxResult = runningTotal.add(props.tax);
    if (withTaxResult.isFailure) return Result.fail<PricingBreakdown>(withTaxResult.getError());

    const expectedTotalResult = withTaxResult.getValue().subtract(props.discount);
    if (expectedTotalResult.isFailure) return Result.fail<PricingBreakdown>(expectedTotalResult.getError());

    if (!expectedTotalResult.getValue().equals(props.total)) {
      return Result.fail<PricingBreakdown>(
        new ValidationError('PricingBreakdown total must equal subtotal + fees - discount + tax')
      );
    }

    return Result.ok<PricingBreakdown>(
      new PricingBreakdown({
        subtotal: props.subtotal,
        fees: [...props.fees],
        discount: props.discount,
        tax: props.tax,
        total: props.total,
      })
    );
  }
}
