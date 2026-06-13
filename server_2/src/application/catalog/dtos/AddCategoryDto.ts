import { ActorContext } from './shared';

export interface AddCategoryDto extends ActorContext {
  restaurantId: string;
  label: string;
  sortOrder?: number;
}
