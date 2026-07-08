import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { ValidationError } from '../../shared/errors/ValidationError';
import { DELIVERY_STATUS, DeliveryStatusValue } from '../enums/delivery-status.enum';

interface DeliveryStatusProps {
  value: DeliveryStatusValue;
}

const ALLOWED_TRANSITIONS: Record<DeliveryStatusValue, DeliveryStatusValue[]> = {
  [DELIVERY_STATUS.UNASSIGNED]: [DELIVERY_STATUS.ASSIGNED],
  [DELIVERY_STATUS.ASSIGNED]: [
    DELIVERY_STATUS.EN_ROUTE_TO_RESTAURANT,
    DELIVERY_STATUS.PICKED_UP,
    DELIVERY_STATUS.UNASSIGNED,
  ],
  [DELIVERY_STATUS.EN_ROUTE_TO_RESTAURANT]: [DELIVERY_STATUS.AT_RESTAURANT],
  [DELIVERY_STATUS.AT_RESTAURANT]: [DELIVERY_STATUS.PICKED_UP],
  [DELIVERY_STATUS.PICKED_UP]: [DELIVERY_STATUS.EN_ROUTE_TO_CUSTOMER, DELIVERY_STATUS.FAILED],
  [DELIVERY_STATUS.EN_ROUTE_TO_CUSTOMER]: [DELIVERY_STATUS.DELIVERED, DELIVERY_STATUS.FAILED],
  [DELIVERY_STATUS.DELIVERED]: [],
  [DELIVERY_STATUS.FAILED]: [],
};

export class DeliveryStatus extends ValueObject<DeliveryStatusProps> {
  private constructor(props: DeliveryStatusProps) {
    super(props);
  }

  get value(): DeliveryStatusValue {
    return this.props.value;
  }

  public static create(value: DeliveryStatusValue): Result<DeliveryStatus> {
    if (!Object.values(DELIVERY_STATUS).includes(value)) {
      return Result.fail<DeliveryStatus>(new ValidationError(`Invalid delivery status: ${value}`));
    }
    return Result.ok<DeliveryStatus>(new DeliveryStatus({ value }));
  }

  /** The initial rider-leg state before any rider has accepted. */
  public static unassigned(): DeliveryStatus {
    return new DeliveryStatus({ value: DELIVERY_STATUS.UNASSIGNED });
  }

  public isTerminal(): boolean {
    return ALLOWED_TRANSITIONS[this.props.value].length === 0;
  }

  public canTransitionTo(target: DeliveryStatusValue): boolean {
    return ALLOWED_TRANSITIONS[this.props.value].includes(target);
  }

  public transitionTo(target: DeliveryStatusValue): Result<DeliveryStatus> {
    if (!this.canTransitionTo(target)) {
      return Result.fail<DeliveryStatus>(
        new ValidationError(`Cannot transition delivery status from ${this.props.value} to ${target}`)
      );
    }
    return DeliveryStatus.create(target);
  }
}
