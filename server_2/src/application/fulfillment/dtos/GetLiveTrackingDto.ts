export interface GetLiveTrackingDto {
  fulfillmentId: string;
  customerId?: string; // used for ownership check when called from the customer API
}
