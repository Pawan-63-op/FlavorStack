import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { ValidationError } from '../../shared/errors/ValidationError';

interface RatingProps {
  value: number;
}

export class Rating extends ValueObject<RatingProps> {
  private constructor(props: RatingProps) {
    super(props);
  }

  get value(): number {
    return this.props.value;
  }

  public static create(value: number): Result<Rating> {
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      return Result.fail<Rating>(new ValidationError('Rating must be an integer between 1 and 5'));
    }
    return Result.ok<Rating>(new Rating({ value }));
  }
}
