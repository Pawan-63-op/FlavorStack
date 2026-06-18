// Maps between the Review aggregate and ReviewModel documents (engagement_module.md §6).
// toDomain rebuilds Rating/ReviewComment/ModerationStatus via create() (trusted data —
// corruption surfaces as DomainError via rebuildOrThrow) and rehydrates the root through
// Review.reconstitute, which raises no events.
import { Review, ReviewProps } from '../../../domain/engagement/entities/Review';
import { Rating } from '../../../domain/engagement/value-objects/Rating';
import { ReviewComment } from '../../../domain/engagement/value-objects/ReviewComment';
import { ModerationStatus } from '../../../domain/engagement/value-objects/ModerationStatus';
import { ModerationStatusValue } from '../../../domain/engagement/enums/moderation-status.enum';
import { UniqueEntityId } from '../../../domain/shared/UniqueEntityId';
import { ReviewDocument } from '../models/ReviewModel';
import { rebuildOrThrow } from './rebuildOrThrow';

export class ReviewMapper {
  static toPersistence(review: Review): ReviewDocument {
    return {
      _id: review.id.toString(),
      customerId: review.customerId,
      restaurantId: review.restaurantId,
      fulfillmentId: review.fulfillmentId,
      restaurantRating: review.restaurantRating.value,
      deliveryRating: review.deliveryRating?.value ?? null,
      comment: review.comment?.value ?? null,
      moderationStatus: review.moderationStatus.value,
      createdAt: review.createdAt,
      moderatedAt: review.moderatedAt,
      moderatedBy: review.moderatedBy,
    };
  }

  static toDomain(doc: ReviewDocument): Review {
    const restaurantRating = rebuildOrThrow(
      Rating.create(doc.restaurantRating),
      `Review restaurantRating (${doc._id})`
    );

    const deliveryRating =
      doc.deliveryRating !== null && doc.deliveryRating !== undefined
        ? rebuildOrThrow(Rating.create(doc.deliveryRating), `Review deliveryRating (${doc._id})`)
        : null;

    const comment =
      doc.comment !== null && doc.comment !== undefined
        ? rebuildOrThrow(ReviewComment.create(doc.comment), `Review comment (${doc._id})`)
        : null;

    const moderationStatus = rebuildOrThrow(
      ModerationStatus.create(doc.moderationStatus as ModerationStatusValue),
      `Review moderationStatus (${doc._id})`
    );

    const props: ReviewProps = {
      customerId: doc.customerId,
      restaurantId: doc.restaurantId,
      fulfillmentId: doc.fulfillmentId,
      restaurantRating,
      deliveryRating,
      comment,
      moderationStatus,
      createdAt: doc.createdAt,
      moderatedAt: doc.moderatedAt,
      moderatedBy: doc.moderatedBy,
    };

    return Review.reconstitute(props, new UniqueEntityId(doc._id));
  }
}
