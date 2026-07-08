import { Result } from '../../../shared/Result';
import { ValidationError } from '../../../shared/errors/ValidationError';
import { Money } from '../../../shared/Money';
import { TaxPolicy } from '../../types/PricingContext';

export class TaxStage {
  public static run(taxableBase: Money, taxPolicy: TaxPolicy): Result<Money> {
    if (!(taxableBase instanceof Money)) {
      return Result.fail<Money>(new ValidationError('Taxable base must be a valid Money value object'));
    }

    const rate = taxPolicy?.rate;
    if (typeof rate !== 'number' || isNaN(rate)) {
      return Result.fail<Money>(new ValidationError('Tax rate must be a valid number'));
    }
    if (rate < 0) {
      return Result.fail<Money>(new ValidationError('Tax rate cannot be negative'));
    }

    return Result.ok<Money>(taxableBase.multiply(rate));
  }
}
