import { ActorContext } from './shared';

export interface RemoveCategoryDto extends ActorContext {
  restaurantId: string;
  categoryId: string;
}
