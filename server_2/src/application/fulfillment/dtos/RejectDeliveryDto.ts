export interface RejectDeliveryDto {
  fulfillmentId: string;
  riderId: string;
  reason?: string;
}
