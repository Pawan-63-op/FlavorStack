export interface IOpeningHoursService {
  isRestaurantOpen(restaurantId: string, at?: Date): Promise<boolean>;
}
