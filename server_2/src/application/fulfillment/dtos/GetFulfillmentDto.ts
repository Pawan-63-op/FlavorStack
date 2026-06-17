export interface GetFulfillmentDto {
  fulfillmentId: string;
  requesterId?: string; // customerId or restaurantId for ownership checks (optional for admin)
}
