import { OrderRequest } from '../../../domain/commerce/entities/OrderRequest';

export interface MoneyResponse {
  amount: number;
  currency: string;
}

export interface OrderRequestOptionView {
  optionId: string;
  label: string;
  priceDelta: MoneyResponse;
}

export interface OrderRequestLineView {
  menuItemId: string;
  name: string;
  quantity: number;
  selectedOptions: OrderRequestOptionView[];
  lineTotal: MoneyResponse;
}

export interface OrderRequestPricingView {
  subtotal: MoneyResponse;
  fees: { type: string; amount: MoneyResponse }[];
  discount: MoneyResponse;
  tax: MoneyResponse;
  total: MoneyResponse;
}

export interface OrderRequestAddressView {
  label?: string;
  street: string;
  city: string;
  state: string;
  pinCode: string;
  coordinates: { lat: number; lng: number };
}

export interface OrderRequestSummaryResponse {
  orderRequestId: string;
  customerId: string;
  restaurantId: string;
  restaurantName: string;
  status: string;
  lines: OrderRequestLineView[];
  pricing: OrderRequestPricingView;
  deliveryAddress: OrderRequestAddressView;
  paymentMethod: string;
  idempotencyKey: string;
  schemaVersion: number;
  createdAt: string;
}

function money(value: { amount: number; currency: string }): MoneyResponse {
  return { amount: value.amount, currency: value.currency };
}

export function toOrderRequestSummaryResponse(order: OrderRequest): OrderRequestSummaryResponse {
  return {
    orderRequestId: order.id.toString(),
    customerId: order.customerId,
    restaurantId: order.restaurant.restaurantId,
    restaurantName: order.restaurant.name,
    status: order.status,
    lines: order.lines.map((line) => ({
      menuItemId: line.menuItem.menuItemId,
      name: line.menuItem.name,
      quantity: line.quantity.value,
      selectedOptions: line.selectedOptions.map((option) => ({
        optionId: option.optionId,
        label: option.label,
        priceDelta: money(option.priceDelta),
      })),
      lineTotal: money(line.lineTotal),
    })),
    pricing: {
      subtotal: money(order.pricing.subtotal),
      fees: order.pricing.fees.map((fee) => ({ type: fee.type, amount: money(fee.amount) })),
      discount: money(order.pricing.discount),
      tax: money(order.pricing.tax),
      total: money(order.pricing.total),
    },
    deliveryAddress: {
      label: order.deliveryAddress.label,
      street: order.deliveryAddress.street,
      city: order.deliveryAddress.city,
      state: order.deliveryAddress.state,
      pinCode: order.deliveryAddress.pinCode,
      coordinates: {
        lat: order.deliveryAddress.coordinates.lat,
        lng: order.deliveryAddress.coordinates.lng,
      },
    },
    paymentMethod: order.paymentIntent.method,
    idempotencyKey: order.idempotencyKey.value,
    schemaVersion: order.schemaVersion,
    createdAt: order.createdAt.toISOString(),
  };
}
