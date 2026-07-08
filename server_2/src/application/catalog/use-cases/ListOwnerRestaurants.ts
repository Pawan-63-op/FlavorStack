import { Result } from '../../../domain/shared/Result';
import { IRestaurantRepository } from '../../../domain/catalog/repositories/IRestaurantRepository';
import { RestaurantResponse } from '../responses/RestaurantResponse';
import { toRestaurantResponse } from '../responses/mappers';
import { ActorContext } from '../dtos/shared';

export interface ListOwnerRestaurantsDto extends ActorContext {
  cursor?: string;
  limit?: number;
}

export interface OwnerRestaurantsPage {
  items: RestaurantResponse[];
  nextCursor?: string;
}

export class ListOwnerRestaurants {
  constructor(private readonly restaurantRepo: IRestaurantRepository) {}

  async execute(dto: ListOwnerRestaurantsDto): Promise<Result<OwnerRestaurantsPage>> {
    const page = await this.restaurantRepo.findByOwner(dto.actorId, {
      cursor: dto.cursor,
      limit: dto.limit,
    });
    return Result.ok({
      items: page.items.map(toRestaurantResponse),
      nextCursor: page.nextCursor,
    });
  }
}
