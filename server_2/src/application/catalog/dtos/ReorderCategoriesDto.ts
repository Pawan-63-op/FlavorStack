import { ActorContext } from './shared';

export interface ReorderCategoriesDto extends ActorContext {
  restaurantId: string;
  orderedCategoryIds: string[];
}
