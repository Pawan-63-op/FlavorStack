// Records who cancelled a fulfillment, why, and when (fulfillment_module.md §2.3).
// Defined in Phase 1 as a building block; the aggregate's cancel() path is realized in Phase 5.
import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { Guard } from '../../shared/Guard';
import { ValidationError } from '../../shared/errors/ValidationError';
import { CANCELLED_BY, CancelledByValue } from '../enums/cancelled-by.enum';

interface CancellationInfoProps {
  cancelledBy: CancelledByValue;
  reason: string;
  at: Date;
}

export interface CreateCancellationInfoInput {
  cancelledBy: CancelledByValue;
  reason: string;
  at?: Date;
}

export class CancellationInfo extends ValueObject<CancellationInfoProps> {
  private constructor(props: CancellationInfoProps) {
    super(props);
  }

  get cancelledBy(): CancelledByValue {
    return this.props.cancelledBy;
  }

  get reason(): string {
    return this.props.reason;
  }

  get at(): Date {
    return this.props.at;
  }

  public static create(input: CreateCancellationInfoInput): Result<CancellationInfo> {
    if (!Object.values(CANCELLED_BY).includes(input.cancelledBy)) {
      return Result.fail<CancellationInfo>(new ValidationError(`Invalid cancelledBy: ${input.cancelledBy}`));
    }

    const reasonCheck = Guard.againstEmptyString(input.reason, 'Cancellation reason');
    if (reasonCheck.isFailure) return Result.fail<CancellationInfo>(reasonCheck.getError());

    return Result.ok<CancellationInfo>(
      new CancellationInfo({
        cancelledBy: input.cancelledBy,
        reason: String(input.reason).trim(),
        at: input.at ?? new Date(),
      })
    );
  }
}
