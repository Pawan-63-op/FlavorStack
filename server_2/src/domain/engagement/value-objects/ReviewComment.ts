// Trimmed, length-capped review comment (engagement_module.md §2). Max 1000 chars.
import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { Guard } from '../../shared/Guard';
import { ValidationError } from '../../shared/errors/ValidationError';

const MAX_LENGTH = 1000;

interface ReviewCommentProps {
  value: string;
}

export class ReviewComment extends ValueObject<ReviewCommentProps> {
  private constructor(props: ReviewCommentProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  get length(): number {
    return this.props.value.length;
  }

  public static create(text: string): Result<ReviewComment> {
    const emptyCheck = Guard.againstEmptyString(text, 'Review comment');
    if (emptyCheck.isFailure) return Result.fail<ReviewComment>(emptyCheck.getError());

    const trimmed = text.trim();
    if (trimmed.length > MAX_LENGTH) {
      return Result.fail<ReviewComment>(new ValidationError(`Review comment must be at most ${MAX_LENGTH} characters`));
    }

    return Result.ok<ReviewComment>(new ReviewComment({ value: trimmed }));
  }
}
