// UC: EditReviewComment — author edits their comment while the review is not yet moderated
// (engagement_module.md §4). No domain event is raised, so this is a plain load → mutate → update.
import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../domain/shared/errors/ForbiddenError';
import { IReviewRepository } from '../../../domain/engagement/repositories/IReviewRepository';
import { EditReviewCommentDto } from '../dtos/ReviewDtos';
import { ReviewResponse, toReviewResponse } from '../responses/ReviewResponse';

export class EditReviewComment {
  constructor(private readonly reviewRepo: IReviewRepository) {}

  async execute(dto: EditReviewCommentDto): Promise<Result<ReviewResponse>> {
    const review = await this.reviewRepo.findById(dto.reviewId);
    if (!review) return Result.fail(new NotFoundError('review_not_found'));

    if (review.customerId !== dto.customerId) {
      return Result.fail(new ForbiddenError('review_not_owned'));
    }

    const edit = review.editComment(dto.comment);
    if (edit.isFailure) return Result.fail(edit.getError());

    await this.reviewRepo.update(review);

    return Result.ok(toReviewResponse(review));
  }
}
