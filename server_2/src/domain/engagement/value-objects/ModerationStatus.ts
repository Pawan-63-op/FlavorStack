// Review moderation state-machine VO (engagement_module.md §2). Mirrors NotificationStatus.
// PENDING/AUTO_FLAGGED -> APPROVED | REJECTED (terminal).
import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { ValidationError } from '../../shared/errors/ValidationError';
import { MODERATION_STATUS, ModerationStatusValue } from '../enums/moderation-status.enum';

interface ModerationStatusProps {
  value: ModerationStatusValue;
}

const ALLOWED_TRANSITIONS: Record<ModerationStatusValue, ModerationStatusValue[]> = {
  [MODERATION_STATUS.PENDING]: [MODERATION_STATUS.APPROVED, MODERATION_STATUS.REJECTED],
  [MODERATION_STATUS.AUTO_FLAGGED]: [MODERATION_STATUS.APPROVED, MODERATION_STATUS.REJECTED],
  [MODERATION_STATUS.APPROVED]: [],
  [MODERATION_STATUS.REJECTED]: [],
};

export class ModerationStatus extends ValueObject<ModerationStatusProps> {
  private constructor(props: ModerationStatusProps) {
    super(props);
  }

  get value(): ModerationStatusValue {
    return this.props.value;
  }

  public static create(value: ModerationStatusValue): Result<ModerationStatus> {
    if (!Object.values(MODERATION_STATUS).includes(value)) {
      return Result.fail<ModerationStatus>(new ValidationError(`Invalid moderation status: ${value}`));
    }
    return Result.ok<ModerationStatus>(new ModerationStatus({ value }));
  }

  public static pending(): ModerationStatus {
    return new ModerationStatus({ value: MODERATION_STATUS.PENDING });
  }

  public static autoFlagged(): ModerationStatus {
    return new ModerationStatus({ value: MODERATION_STATUS.AUTO_FLAGGED });
  }

  public isTerminal(): boolean {
    return ALLOWED_TRANSITIONS[this.props.value].length === 0;
  }

  public canTransitionTo(target: ModerationStatusValue): boolean {
    return ALLOWED_TRANSITIONS[this.props.value].includes(target);
  }

  public transitionTo(target: ModerationStatusValue): Result<ModerationStatus> {
    if (!this.canTransitionTo(target)) {
      return Result.fail<ModerationStatus>(
        new ValidationError(`Cannot transition moderation status from ${this.props.value} to ${target}`)
      );
    }
    return ModerationStatus.create(target);
  }
}
