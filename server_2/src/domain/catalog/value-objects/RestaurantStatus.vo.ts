import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { ValidationError } from '../../shared/errors/ValidationError';
import { RESTAURANT_STATUS, RestaurantStatus as RestaurantStatusValue } from '../enums/restaurant-status.enum';

interface RestaurantStatusProps {
  value: RestaurantStatusValue;
}

const ALLOWED_TRANSITIONS: Record<RestaurantStatusValue, RestaurantStatusValue[]> = {
  [RESTAURANT_STATUS.DRAFT]: [RESTAURANT_STATUS.ACTIVE],
  [RESTAURANT_STATUS.ACTIVE]: [RESTAURANT_STATUS.PAUSED, RESTAURANT_STATUS.CLOSED],
  [RESTAURANT_STATUS.PAUSED]: [RESTAURANT_STATUS.ACTIVE, RESTAURANT_STATUS.CLOSED],
  [RESTAURANT_STATUS.CLOSED]: [],
};

export class RestaurantStatus extends ValueObject<RestaurantStatusProps> {
  private constructor(props: RestaurantStatusProps) {
    super(props);
  }

  get value(): RestaurantStatusValue {
    return this.props.value;
  }

  public static create(value: RestaurantStatusValue): Result<RestaurantStatus> {
    if (!Object.values(RESTAURANT_STATUS).includes(value)) {
      return Result.fail<RestaurantStatus>(new ValidationError(`Invalid restaurant status: ${value}`));
    }
    return Result.ok<RestaurantStatus>(new RestaurantStatus({ value }));
  }

  public canTransitionTo(target: RestaurantStatusValue): boolean {
    return ALLOWED_TRANSITIONS[this.props.value].includes(target);
  }

  public transitionTo(target: RestaurantStatusValue): Result<RestaurantStatus> {
    if (!this.canTransitionTo(target)) {
      return Result.fail<RestaurantStatus>(
        new ValidationError(`Cannot transition restaurant status from ${this.props.value} to ${target}`)
      );
    }
    return RestaurantStatus.create(target);
  }
}
