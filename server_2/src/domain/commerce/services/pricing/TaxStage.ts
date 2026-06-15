import { Result } from '../../../shared/Result';
import { ValidationError } from '../../../shared/errors/ValidationError';
import { Money } from '../../../shared/Money';
import { TaxPolicy } from '../../types/PricingContext';

// Pricing pipeline stage 5 (Commerce Phase 7, §4.2) — pure.
// Applies the tax policy's decimal rate to a taxable base, producing a tax Money.
// Money.multiply keeps integer-minor-unit discipline (rounds to the nearest paise),
// so no floating-point leaks into the breakdown. The taxable base is assembled by
// the calculator (subtotal + Σfees − discount); the stage stays agnostic to how it
// was derived so the base composition can evolve without touching tax logic.
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
