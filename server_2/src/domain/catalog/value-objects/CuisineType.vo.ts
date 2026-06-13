import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { ValidationError } from '../../shared/errors/ValidationError';
import { CUISINE_TYPE, CuisineType as CuisineTypeValue } from '../enums/cuisine-type.enum';

interface CuisineTypeProps {
  value: CuisineTypeValue;
}

export class CuisineType extends ValueObject<CuisineTypeProps> {
  private constructor(props: CuisineTypeProps) {
    super(props);
  }

  get value(): CuisineTypeValue {
    return this.props.value;
  }

  public static create(value: CuisineTypeValue): Result<CuisineType> {
    if (!Object.values(CUISINE_TYPE).includes(value)) {
      return Result.fail<CuisineType>(new ValidationError(`Invalid cuisine type: ${value}`));
    }
    return Result.ok<CuisineType>(new CuisineType({ value }));
  }
}
