import { Result } from '../../../domain/shared/Result';
import { IReviewRepository } from '../../../domain/engagement/repositories/IReviewRepository';
import { GetMyReviewsDto } from '../dtos/ReviewDtos';
import { ReviewResponse, toReviewResponse } from '../responses/ReviewResponse';

export class GetMyReviews {
  constructor(private readonly reviewRepo: IReviewRepository) {}

  async execute(dto: GetMyReviewsDto): Promise<Result<ReviewResponse[]>> {
    const reviews = await this.reviewRepo.findByCustomer(dto.customerId, { limit: dto.limit, offset: dto.offset });
    return Result.ok(reviews.map(toReviewResponse));
  }
}
