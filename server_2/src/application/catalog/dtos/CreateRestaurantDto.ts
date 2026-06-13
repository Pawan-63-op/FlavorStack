import { ActorContext, AddressInput, GeoPointInput } from './shared';

export interface CreateRestaurantDto extends ActorContext {
  name: string;
  slug?: string;
  description?: string;
  cuisineTypes: string[];
  address: AddressInput;
  location: GeoPointInput;
  phone: string;
  imageUrl?: string;
}
