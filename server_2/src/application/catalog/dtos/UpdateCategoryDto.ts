import { ActorContext } from './shared';

export interface UpdateCategoryDto extends ActorContext {
  restaurantId: string;
  categoryId: string;
  label?: string;
  sortOrder?: number;
  isActive?: boolean;
}
