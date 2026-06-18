// Notification dispatch lifecycle state-machine VO (engagement_module.md §2). Mirrors
// fulfillment/value-objects/FulfillmentStatus.ts: private ctor + static create(), canTransitionTo(),
// transitionTo(): Result<VO>. PENDING -> SENT | FAILED; SENT -> READ.
import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { ValidationError } from '../../shared/errors/ValidationError';
import { NOTIFICATION_STATUS, NotificationStatusValue } from '../enums/notification-status.enum';

interface NotificationStatusProps {
  value: NotificationStatusValue;
}

const ALLOWED_TRANSITIONS: Record<NotificationStatusValue, NotificationStatusValue[]> = {
  [NOTIFICATION_STATUS.PENDING]: [NOTIFICATION_STATUS.SENT, NOTIFICATION_STATUS.FAILED],
  [NOTIFICATION_STATUS.SENT]: [NOTIFICATION_STATUS.READ],
  [NOTIFICATION_STATUS.FAILED]: [],
  [NOTIFICATION_STATUS.READ]: [],
};

export class NotificationStatus extends ValueObject<NotificationStatusProps> {
  private constructor(props: NotificationStatusProps) {
    super(props);
  }

  get value(): NotificationStatusValue {
    return this.props.value;
  }

  public static create(value: NotificationStatusValue): Result<NotificationStatus> {
    if (!Object.values(NOTIFICATION_STATUS).includes(value)) {
      return Result.fail<NotificationStatus>(new ValidationError(`Invalid notification status: ${value}`));
    }
    return Result.ok<NotificationStatus>(new NotificationStatus({ value }));
  }

  public static pending(): NotificationStatus {
    return new NotificationStatus({ value: NOTIFICATION_STATUS.PENDING });
  }

  public isTerminal(): boolean {
    return ALLOWED_TRANSITIONS[this.props.value].length === 0;
  }

  public canTransitionTo(target: NotificationStatusValue): boolean {
    return ALLOWED_TRANSITIONS[this.props.value].includes(target);
  }

  public transitionTo(target: NotificationStatusValue): Result<NotificationStatus> {
    if (!this.canTransitionTo(target)) {
      return Result.fail<NotificationStatus>(
        new ValidationError(`Cannot transition notification status from ${this.props.value} to ${target}`)
      );
    }
    return NotificationStatus.create(target);
  }
}
