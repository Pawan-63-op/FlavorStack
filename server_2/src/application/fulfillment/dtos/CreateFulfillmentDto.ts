export interface CreateFulfillmentMoneyDto {
  amount: number;
  currency: string;
}

export interface CreateFulfillmentOptionDto {
  optionId: string;
  label: string;
  priceDelta: CreateFulfillmentMoneyDto;
}

export interface CreateFulfillmentLineDto {
  menuItemId: string;
  name: string;
  quantity: number;
  selectedOptions: CreateFulfillmentOptionDto[];
  lineTotal: CreateFulfillmentMoneyDto;
}

export interface CreateFulfillmentAddressDto {
  label?: string;
  street: string;
  city: string;
  state: string;
  pinCode: string;
  coordinates: { lat: number; lng: number };
}

export interface CreateFulfillmentDto {
  orderRequestId: string;
  customerId: string;
  restaurantId: string;
  lines: CreateFulfillmentLineDto[];
  deliveryAddress: CreateFulfillmentAddressDto;
  total: CreateFulfillmentMoneyDto;
}
