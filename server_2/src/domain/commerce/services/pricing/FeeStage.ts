import { Result } from '../../../shared/Result';
import { ValidationError } from '../../../shared/errors/ValidationError';
import { Money } from '../../../shared/Money';
import { Fee } from '../../value-objects/Fee';
import { FEE_TYPE } from '../../enums/fee-type.enum';
import { RestaurantFeeInputs } from '../../types/PricingContext';

// Pricing pipeline stage 2 (Commerce Phase 7, §4.2) — pure.
// Emits the restaurant-sourced fees: a PLATFORM fee and a PACKAGING fee.
// Both are always emitted (even when zero) so the breakdown is explicit and
// downstream totals fold Σfees uniformly. New restaurant fees become new
// entries here without touching consumers.
export class FeeStage {
  public static run(inputs: RestaurantFeeInputs): Result<Fee[]> {
    if (!(inputs.platformFee instanceof Money)) {
      return Result.fail<Fee[]>(new ValidationError('platformFee must be a valid Money value object'));
    }
    if (!(inputs.packagingFee instanceof Money)) {
      return Result.fail<Fee[]>(new ValidationError('packagingFee must be a valid Money value object'));
    }

    const platformResult = Fee.create({ type: FEE_TYPE.PLATFORM, amount: inputs.platformFee });
    if (platformResult.isFailure) return Result.fail<Fee[]>(platformResult.getError());

    const packagingResult = Fee.create({ type: FEE_TYPE.PACKAGING, amount: inputs.packagingFee });
    if (packagingResult.isFailure) return Result.fail<Fee[]>(packagingResult.getError());

    return Result.ok<Fee[]>([platformResult.getValue(), packagingResult.getValue()]);
  }
}
