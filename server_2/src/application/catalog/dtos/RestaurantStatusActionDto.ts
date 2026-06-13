import { ActorContext } from './shared';

/** Shared by PublishRestaurant, PauseRestaurant, CloseRestaurant and DeleteRestaurant. */
export interface RestaurantStatusActionDto extends ActorContext {
  restaurantId: string;
}
