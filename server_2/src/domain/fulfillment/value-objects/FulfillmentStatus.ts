// Master fulfillment state-machine VO (fulfillment_module.md §4.1). Mirrors
// catalog/value-objects/RestaurantStatus.vo.ts: private ctor + static create(),
// canTransitionTo(), transitionTo(): Result<VO>. The full transition table is encoded so later
// phases drive prep/pickup/delivery; Phase 1 only ever constructs CREATED.
import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { ValidationError } from '../../shared/errors/ValidationError';
import { FULFILLMENT_STATUS, FulfillmentStatusValue } from '../enums/fulfillment-status.enum';

interface FulfillmentStatusProps {
  value: FulfillmentStatusValue;
}

const ALLOWED_TRANSITIONS: Record<FulfillmentStatusValue, FulfillmentStatusValue[]> = {
  [FULFILLMENT_STATUS.CREATED]: [FULFILLMENT_STATUS.PREPARING, FULFILLMENT_STATUS.CANCELLED],
  [FULFILLMENT_STATUS.PREPARING]: [FULFILLMENT_STATUS.READY_FOR_PICKUP, FULFILLMENT_STATUS.CANCELLED],
  [FULFILLMENT_STATUS.READY_FOR_PICKUP]: [FULFILLMENT_STATUS.PICKED_UP, FULFILLMENT_STATUS.CANCELLED],
  [FULFILLMENT_STATUS.PICKED_UP]: [FULFILLMENT_STATUS.OUT_FOR_DELIVERY, FULFILLMENT_STATUS.FAILED],
  [FULFILLMENT_STATUS.OUT_FOR_DELIVERY]: [FULFILLMENT_STATUS.DELIVERED, FULFILLMENT_STATUS.FAILED],
  [FULFILLMENT_STATUS.DELIVERED]: [],
  [FULFILLMENT_STATUS.CANCELLED]: [],
  [FULFILLMENT_STATUS.FAILED]: [],
};

export class FulfillmentStatus extends ValueObject<FulfillmentStatusProps> {
  private constructor(props: FulfillmentStatusProps) {
    super(props);
  }

  get value(): FulfillmentStatusValue {
    return this.props.value;
  }

  public static create(value: FulfillmentStatusValue): Result<FulfillmentStatus> {
    if (!Object.values(FULFILLMENT_STATUS).includes(value)) {
      return Result.fail<FulfillmentStatus>(new ValidationError(`Invalid fulfillment status: ${value}`));
    }
    return Result.ok<FulfillmentStatus>(new FulfillmentStatus({ value }));
  }

  /** The initial state when a fulfillment is created from an OrderRequested event. */
  public static created(): FulfillmentStatus {
    return new FulfillmentStatus({ value: FULFILLMENT_STATUS.CREATED });
  }

  public isTerminal(): boolean {
    return ALLOWED_TRANSITIONS[this.props.value].length === 0;
  }

  public canTransitionTo(target: FulfillmentStatusValue): boolean {
    return ALLOWED_TRANSITIONS[this.props.value].includes(target);
  }

  public transitionTo(target: FulfillmentStatusValue): Result<FulfillmentStatus> {
    if (!this.canTransitionTo(target)) {
      return Result.fail<FulfillmentStatus>(
        new ValidationError(`Cannot transition fulfillment status from ${this.props.value} to ${target}`)
      );
    }
    return FulfillmentStatus.create(target);
  }
}
