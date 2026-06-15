// Input DTO: GetOrderRequest — { orderRequestId, customerId }. customerId is the
// authenticated actor used for the ownership check; it is never taken from the path/body.
export interface GetOrderRequestDto {
  orderRequestId: string;
  customerId: string;
}
