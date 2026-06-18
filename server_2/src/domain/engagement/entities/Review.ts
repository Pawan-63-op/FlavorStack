// Review — restaurant + delivery rating sharing one fulfillment consistency boundary
// (engagement_module.md §2). Key: reviewId; uniqueness (customerId, fulfillmentId) is a
// DB-level invariant enforced by the repository's unique index, not by this aggregate.
import { AggregateRoot } from '../../shared/AggregateRoot';
import { Result } from '../../shared/Result';
import { Guard } from '../../shared/Guard';
import { UniqueEntityId } from '../../shared/UniqueEntityId';
import { ValidationError } from '../../shared/errors/ValidationError';
import { Rating } from '../value-objects/Rating';
import { ReviewComment } from '../value-objects/ReviewComment';
import { ModerationStatus } from '../value-objects/ModerationStatus';
import { MODERATION_STATUS } from '../enums/moderation-status.enum';
import { ReviewSubmitted } from '../events/ReviewSubmitted';
import { ReviewModerated } from '../events/ReviewModerated';

// Minimal word-list profanity scan (engagement_module.md §2 "basic moderation"). No ML.
const PROFANITY_WORDLIST = ['fuck', 'shit', 'bastard', 'asshole', 'bitch'];

function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase();
  return PROFANITY_WORDLIST.some((word) => lower.includes(word));
}

export interface ReviewProps {
  customerId: string;
  restaurantId: string;
  fulfillmentId: string;
  restaurantRating: Rating;
  deliveryRating: Rating | null;
  comment: ReviewComment | null;
  moderationStatus: ModerationStatus;
  createdAt: Date;
  moderatedAt?: Date;
  moderatedBy?: string;
}

export interface SubmitReviewInput {
  customerId: string;
  restaurantId: string;
  fulfillmentId: string;
  restaurantRating: number;
  deliveryRating?: number | null;
  comment?: string | null;
  id?: UniqueEntityId;
}

export class Review extends AggregateRoot<ReviewProps> {
  private constructor(props: ReviewProps, id?: UniqueEntityId) {
    super(props, id);
  }

  get customerId(): string {
    return this.props.customerId;
  }
  get restaurantId(): string {
    return this.props.restaurantId;
  }
  get fulfillmentId(): string {
    return this.props.fulfillmentId;
  }
  get restaurantRating(): Rating {
    return this.props.restaurantRating;
  }
  get deliveryRating(): Rating | null {
    return this.props.deliveryRating;
  }
  get comment(): ReviewComment | null {
    return this.props.comment;
  }
  get moderationStatus(): ModerationStatus {
    return this.props.moderationStatus;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get moderatedAt(): Date | undefined {
    return this.props.moderatedAt;
  }
  get moderatedBy(): string | undefined {
    return this.props.moderatedBy;
  }

  public static submit(input: SubmitReviewInput): Result<Review> {
    const customerIdCheck = Guard.againstEmptyString(input.customerId, 'CustomerId');
    if (customerIdCheck.isFailure) return Result.fail<Review>(customerIdCheck.getError());

    const restaurantIdCheck = Guard.againstEmptyString(input.restaurantId, 'RestaurantId');
    if (restaurantIdCheck.isFailure) return Result.fail<Review>(restaurantIdCheck.getError());

    const fulfillmentIdCheck = Guard.againstEmptyString(input.fulfillmentId, 'FulfillmentId');
    if (fulfillmentIdCheck.isFailure) return Result.fail<Review>(fulfillmentIdCheck.getError());

    const restaurantRatingResult = Rating.create(input.restaurantRating);
    if (restaurantRatingResult.isFailure) return Result.fail<Review>(restaurantRatingResult.getError());

    let deliveryRating: Rating | null = null;
    if (input.deliveryRating !== undefined && input.deliveryRating !== null) {
      const deliveryRatingResult = Rating.create(input.deliveryRating);
      if (deliveryRatingResult.isFailure) return Result.fail<Review>(deliveryRatingResult.getError());
      deliveryRating = deliveryRatingResult.getValue();
    }

    let comment: ReviewComment | null = null;
    if (input.comment !== undefined && input.comment !== null) {
      const commentResult = ReviewComment.create(input.comment);
      if (commentResult.isFailure) return Result.fail<Review>(commentResult.getError());
      comment = commentResult.getValue();
    }

    const moderationStatus =
      comment && containsProfanity(comment.value) ? ModerationStatus.autoFlagged() : ModerationStatus.pending();

    const review = new Review(
      {
        customerId: input.customerId,
        restaurantId: input.restaurantId,
        fulfillmentId: input.fulfillmentId,
        restaurantRating: restaurantRatingResult.getValue(),
        deliveryRating,
        comment,
        moderationStatus,
        createdAt: new Date(),
      },
      input.id
    );

    review.addDomainEvent(
      new ReviewSubmitted({
        reviewId: review.id.toString(),
        customerId: review.props.customerId,
        restaurantId: review.props.restaurantId,
        fulfillmentId: review.props.fulfillmentId,
        restaurantRating: review.props.restaurantRating.value,
        deliveryRating: review.props.deliveryRating?.value ?? null,
        hasComment: review.props.comment !== null,
        moderationStatus: review.props.moderationStatus.value,
      })
    );

    return Result.ok<Review>(review);
  }

  /** Only while not yet moderated (PENDING or AUTO_FLAGGED). */
  public editComment(text: string): Result<void> {
    if (this.props.moderationStatus.isTerminal()) {
      return Result.fail<void>(new ValidationError('Cannot edit the comment of a moderated review'));
    }

    const commentResult = ReviewComment.create(text);
    if (commentResult.isFailure) return Result.fail<void>(commentResult.getError());

    this.props.comment = commentResult.getValue();
    return Result.ok<void>(undefined);
  }

  public approve(moderatorId: string): Result<void> {
    return this.moderate(moderatorId, MODERATION_STATUS.APPROVED);
  }

  public reject(moderatorId: string, reason: string): Result<void> {
    const reasonCheck = Guard.againstEmptyString(reason, 'Rejection reason');
    if (reasonCheck.isFailure) return Result.fail<void>(reasonCheck.getError());

    return this.moderate(moderatorId, MODERATION_STATUS.REJECTED);
  }

  private moderate(moderatorId: string, target: typeof MODERATION_STATUS.APPROVED | typeof MODERATION_STATUS.REJECTED): Result<void> {
    const moderatorIdCheck = Guard.againstEmptyString(moderatorId, 'ModeratorId');
    if (moderatorIdCheck.isFailure) return Result.fail<void>(moderatorIdCheck.getError());

    const transition = this.props.moderationStatus.transitionTo(target);
    if (transition.isFailure) return Result.fail<void>(transition.getError());

    this.props.moderationStatus = transition.getValue();
    this.props.moderatedAt = new Date();
    this.props.moderatedBy = moderatorId;

    this.addDomainEvent(
      new ReviewModerated({
        reviewId: this.id.toString(),
        restaurantId: this.props.restaurantId,
        status: target,
        moderatorId,
      })
    );

    return Result.ok<void>(undefined);
  }

  public static reconstitute(props: ReviewProps, id: UniqueEntityId): Review {
    return new Review({ ...props }, id);
  }
}
