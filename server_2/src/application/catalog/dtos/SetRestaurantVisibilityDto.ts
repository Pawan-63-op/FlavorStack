import { CatalogVisibility } from '../../../domain/catalog/enums/catalog-visibility.enum';
import { ActorContext } from './shared';

export interface SetRestaurantVisibilityDto extends ActorContext {
  restaurantId: string;
  visibility: CatalogVisibility;
}
