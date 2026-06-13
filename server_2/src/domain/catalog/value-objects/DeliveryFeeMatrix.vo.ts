import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { ValidationError } from '../../shared/errors/ValidationError';
import { Money } from '../../shared/Money';

export interface DeliveryFeeTier {
  maxDistanceMeters: number;
  fee: Money;
}

interface DeliveryFeeMatrixProps {
  tiers: DeliveryFeeTier[];
  freeAboveSubtotal?: Money;
}

export class DeliveryFeeMatrix extends ValueObject<DeliveryFeeMatrixProps> {
  private constructor(props: DeliveryFeeMatrixProps) {
    super(props);
  }

  get tiers(): DeliveryFeeTier[] {
    return this.props.tiers;
  }

  get freeAboveSubtotal(): Money | undefined {
    return this.props.freeAboveSubtotal;
  }

  public static create(props: { tiers: DeliveryFeeTier[]; freeAboveSubtotal?: Money }): Result<DeliveryFeeMatrix> {
    if (!Array.isArray(props.tiers) || props.tiers.length === 0) {
      return Result.fail<DeliveryFeeMatrix>(new ValidationError('Delivery fee matrix requires at least one tier'));
    }

    let previousMax = 0;
    for (const tier of props.tiers) {
      if (typeof tier.maxDistanceMeters !== 'number' || isNaN(tier.maxDistanceMeters)) {
        return Result.fail<DeliveryFeeMatrix>(new ValidationError('Tier maxDistanceMeters must be a valid number'));
      }
      if (tier.maxDistanceMeters <= 0) {
        return Result.fail<DeliveryFeeMatrix>(new ValidationError('Tier maxDistanceMeters must be positive'));
      }
      if (tier.maxDistanceMeters <= previousMax) {
        return Result.fail<DeliveryFeeMatrix>(new ValidationError('Tier maxDistanceMeters must be strictly increasing'));
      }
      if (!(tier.fee instanceof Money)) {
        return Result.fail<DeliveryFeeMatrix>(new ValidationError('Tier fee must be a Money value'));
      }
      previousMax = tier.maxDistanceMeters;
    }

    if (props.freeAboveSubtotal !== undefined && !(props.freeAboveSubtotal instanceof Money)) {
      return Result.fail<DeliveryFeeMatrix>(new ValidationError('freeAboveSubtotal must be a Money value'));
    }

    return Result.ok<DeliveryFeeMatrix>(
      new DeliveryFeeMatrix({ tiers: [...props.tiers], freeAboveSubtotal: props.freeAboveSubtotal })
    );
  }

  /** Resolves the delivery fee for a given distance and order subtotal. */
  public feeFor(distanceMeters: number, subtotal: Money): Money {
    if (this.props.freeAboveSubtotal) {
      const meetsThreshold =
        subtotal.isGreaterThan(this.props.freeAboveSubtotal) || subtotal.equals(this.props.freeAboveSubtotal);
      if (meetsThreshold) {
        return Money.create(0, subtotal.currency).getValue();
      }
    }

    const tier = this.props.tiers.find((t) => distanceMeters <= t.maxDistanceMeters);
    return tier ? tier.fee : this.props.tiers[this.props.tiers.length - 1].fee;
  }
}
