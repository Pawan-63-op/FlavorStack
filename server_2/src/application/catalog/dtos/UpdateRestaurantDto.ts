import { CuisineType } from '../../../domain/catalog/enums/cuisine-type.enum';
import { ActorContext, AddressInput, GeoPointInput } from './shared';

export interface UpdateRestaurantDto extends ActorContext {
  restaurantId: string;
  name?: string;
  description?: string;
  cuisineTypes?: CuisineType[];
  address?: AddressInput;
  location?: GeoPointInput;
  phone?: string;
  imageUrl?: string;
}
