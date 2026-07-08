export interface PreviewCheckoutDto {
  customerId: string;
  deliveryPoint: {
    lat: number;
    lng: number;
  };
}
