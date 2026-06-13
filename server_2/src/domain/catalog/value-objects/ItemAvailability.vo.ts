import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { ValidationError } from '../../shared/errors/ValidationError';

interface ItemAvailabilityProps {
  isAvailable: boolean;
  availableFrom?: Date;
  availableUntil?: Date;
  outOfStockReason?: string;
}

export class ItemAvailability extends ValueObject<ItemAvailabilityProps> {
  private constructor(props: ItemAvailabilityProps) {
    super(props);
  }

  get isAvailable(): boolean {
    return this.props.isAvailable;
  }

  get availableFrom(): Date | undefined {
    return this.props.availableFrom;
  }

  get availableUntil(): Date | undefined {
    return this.props.availableUntil;
  }

  get outOfStockReason(): string | undefined {
    return this.props.outOfStockReason;
  }

  public static create(props: {
    isAvailable: boolean;
    availableFrom?: Date;
    availableUntil?: Date;
    outOfStockReason?: string;
  }): Result<ItemAvailability> {
    if (typeof props.isAvailable !== 'boolean') {
      return Result.fail<ItemAvailability>(new ValidationError('isAvailable must be a boolean'));
    }

    if (props.availableFrom && props.availableUntil && props.availableFrom >= props.availableUntil) {
      return Result.fail<ItemAvailability>(new ValidationError('availableFrom must be before availableUntil'));
    }

    if (props.outOfStockReason !== undefined && props.isAvailable) {
      return Result.fail<ItemAvailability>(
        new ValidationError('outOfStockReason can only be set when the item is unavailable')
      );
    }

    return Result.ok<ItemAvailability>(
      new ItemAvailability({
        isAvailable: props.isAvailable,
        availableFrom: props.availableFrom,
        availableUntil: props.availableUntil,
        outOfStockReason: props.outOfStockReason,
      })
    );
  }

  public isAvailableAt(now: Date): boolean {
    if (!this.props.isAvailable) {
      return false;
    }
    if (this.props.availableFrom && now < this.props.availableFrom) {
      return false;
    }
    if (this.props.availableUntil && now > this.props.availableUntil) {
      return false;
    }
    return true;
  }
}
