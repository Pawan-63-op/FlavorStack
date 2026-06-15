import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { ValidationError } from '../../shared/errors/ValidationError';
import { Money } from '../../shared/Money';
import { FEE_TYPE, FeeType } from '../enums/fee-type.enum';

interface FeeProps {
  type: FeeType;
  amount: Money;
}

export class Fee extends ValueObject<FeeProps> {
  private constructor(props: FeeProps) {
    super(props);
  }

  get type(): FeeType {
    return this.props.type;
  }

  get amount(): Money {
    return this.props.amount;
  }

  public static create(props: { type: FeeType; amount: Money }): Result<Fee> {
    const validTypes = Object.values(FEE_TYPE) as string[];
    if (!validTypes.includes(props.type)) {
      return Result.fail<Fee>(new ValidationError(`Fee type must be one of: ${validTypes.join(', ')}`));
    }

    if (!(props.amount instanceof Money)) {
      return Result.fail<Fee>(new ValidationError('Fee amount must be a valid Money value object'));
    }

    return Result.ok<Fee>(new Fee({ type: props.type, amount: props.amount }));
  }
}
