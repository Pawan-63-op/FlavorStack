import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { Guard } from '../../shared/Guard';
import { ValidationError } from '../../shared/errors/ValidationError';

interface QuantityProps {
  value: number;
}

export class Quantity extends ValueObject<QuantityProps> {
  public static readonly MIN = 1;
  public static readonly MAX = 99;

  private constructor(props: QuantityProps) {
    super(props);
  }

  get value(): number {
    return this.props.value;
  }

  public static create(value: number): Result<Quantity> {
    if (typeof value !== 'number' || isNaN(value)) {
      return Result.fail<Quantity>(new ValidationError('Quantity must be a valid number'));
    }

    if (!Number.isInteger(value)) {
      return Result.fail<Quantity>(new ValidationError('Quantity must be an integer'));
    }

    const rangeCheck = Guard.inRange(value, Quantity.MIN, Quantity.MAX, 'Quantity');
    if (rangeCheck.isFailure) return Result.fail<Quantity>(rangeCheck.getError());

    return Result.ok<Quantity>(new Quantity({ value }));
  }

  public add(other: Quantity): Result<Quantity> {
    return Quantity.create(this.props.value + other.value);
  }
}
