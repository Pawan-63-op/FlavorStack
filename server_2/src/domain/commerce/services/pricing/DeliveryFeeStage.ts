import { Result } from '../../../shared/Result';
import { ValidationError } from '../../../shared/errors/ValidationError';
import { Money } from '../../../shared/Money';
import { Fee } from '../../value-objects/Fee';
import { FEE_TYPE } from '../../enums/fee-type.enum';
import { DeliveryFeeInput } from '../../types/PricingContext';

// Pricing pipeline stage 3 (Commerce Phase 7, §4.2) — pure.
// Resolves the DELIVERY fee via a commerce-local distance→tier lookup with a
// free-above-subtotal threshold. This deliberately mirrors Catalog's
// DeliveryFeeMatrix.feeFor logic WITHOUT importing it — cross-context coupling
// is forbidden (CLAUDE.md), and the tier inputs arrive as plain data on the
// PricingContext (sourced from the Catalog snapshot/ACL read upstream).
export class DeliveryFeeStage {
  public static run(input: DeliveryFeeInput, subtotal: Money): Result<Fee> {
    if (!(subtotal instanceof Money)) {
      return Result.fail<Fee>(new ValidationError('Subtotal must be a valid Money value object'));
    }

    const tiers = input.feeTiers;
    if (!Array.isArray(tiers) || tiers.length === 0) {
      return Result.fail<Fee>(new ValidationError('Delivery fee requires at least one tier'));
    }

    if (typeof input.distanceMeters !== 'number' || isNaN(input.distanceMeters) || input.distanceMeters < 0) {
      return Result.fail<Fee>(new ValidationError('distanceMeters must be a non-negative number'));
    }

    let previousMax = 0;
    for (const tier of tiers) {
      if (typeof tier.maxDistanceMeters !== 'number' || isNaN(tier.maxDistanceMeters) || tier.maxDistanceMeters <= 0) {
        return Result.fail<Fee>(new ValidationError('Tier maxDistanceMeters must be a positive number'));
      }
      if (tier.maxDistanceMeters <= previousMax) {
        return Result.fail<Fee>(new ValidationError('Tier maxDistanceMeters must be strictly increasing'));
      }
      if (!(tier.fee instanceof Money)) {
        return Result.fail<Fee>(new ValidationError('Tier fee must be a valid Money value object'));
      }
      previousMax = tier.maxDistanceMeters;
    }

    if (input.freeAboveSubtotal !== undefined && !(input.freeAboveSubtotal instanceof Money)) {
      return Result.fail<Fee>(new ValidationError('freeAboveSubtotal must be a valid Money value object'));
    }

    let amount: Money;
    if (
      input.freeAboveSubtotal !== undefined &&
      (subtotal.isGreaterThan(input.freeAboveSubtotal) || subtotal.equals(input.freeAboveSubtotal))
    ) {
      const zeroResult = Money.create(0, subtotal.currency);
      if (zeroResult.isFailure) return Result.fail<Fee>(zeroResult.getError());
      amount = zeroResult.getValue();
    } else {
      const tier = tiers.find((t) => input.distanceMeters <= t.maxDistanceMeters);
      amount = tier ? tier.fee : tiers[tiers.length - 1].fee;
    }

    return Fee.create({ type: FEE_TYPE.DELIVERY, amount });
  }
}
