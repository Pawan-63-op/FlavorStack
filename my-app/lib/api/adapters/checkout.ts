import { formatMoney, type Money } from "../format/money";
import { toMajorMoney } from "./cart";

/**
 * server_2 checkout DTOs → app checkout view-models.
 *
 * Mapping source: `my-app/integration_phases/Phase_6.md` (frozen server_2
 * checkout contracts) — implemented in Phase 6 (checkout preview/place-order).
 *
 * Money amounts on the wire are integer minor units; conversion to major
 * units mirrors `adapters/cart.ts`.
 */
export interface MoneyResponse {
  amount: number;
  currency: string;
}

export type FeeType = "PLATFORM" | "PACKAGING" | "DELIVERY";

export type PaymentMethod = "CARD" | "UPI" | "WALLET" | "COD";

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "CARD", label: "Card" },
  { value: "UPI", label: "UPI" },
  { value: "WALLET", label: "Wallet" },
  { value: "COD", label: "Cash on Delivery" },
];

export interface FeeResponse {
  type: FeeType;
  amount: MoneyResponse;
}

export interface PricingResponse {
  subtotal: MoneyResponse;
  fees: FeeResponse[];
  discount: MoneyResponse;
  tax: MoneyResponse;
  total: MoneyResponse;
}

/** Preview line (`CheckoutViewResponse.lines`) — carries `unitPrice`. */
export interface OrderLineResponse {
  menuItemId: string;
  name: string | null;
  quantity: number;
  unitPrice: MoneyResponse;
  lineTotal: MoneyResponse;
}

export interface OrderRequestOptionResponse {
  optionId: string;
  label: string;
  priceDelta: MoneyResponse;
}

/**
 * Order-request line (`OrderRequestSummaryResponse.lines`). Unlike the preview
 * line it has **no `unitPrice`** — the persisted aggregate keeps `selectedOptions`
 * + a `lineTotal` only. Mapping these as preview lines would dereference an
 * undefined `unitPrice`, so the confirmation path uses its own adapter.
 */
export interface OrderRequestLineResponse {
  menuItemId: string;
  name: string | null;
  quantity: number;
  selectedOptions: OrderRequestOptionResponse[];
  lineTotal: MoneyResponse;
}

export interface PromotionResponse {
  code: string;
  kind: string;
  discount: MoneyResponse;
  sourceRef: string;
}

export interface CheckoutPreviewResponseDto {
  restaurantId: string;
  lines: OrderLineResponse[];
  pricing: PricingResponse;
  serviceable: boolean;
  distanceMeters: number;
  deliveryFee: MoneyResponse;
  minOrder: MoneyResponse;
  promotion: PromotionResponse | null;
}

export interface DeliveryAddressResponse {
  label?: string;
  street: string;
  city: string;
  state: string;
  pinCode: string;
  coordinates: { lat: number; lng: number };
}

export interface OrderRequestSummaryDto {
  orderRequestId: string;
  customerId: string;
  restaurantId: string;
  restaurantName: string;
  status: "REQUESTED";
  lines: OrderRequestLineResponse[];
  pricing: PricingResponse;
  deliveryAddress: DeliveryAddressResponse;
  paymentMethod: PaymentMethod;
  idempotencyKey: string;
  schemaVersion: number;
  createdAt: string;
}

export interface FeeVM {
  type: FeeType;
  amount: Money;
  formattedAmount: string;
}

export interface PricingVM {
  subtotal: Money;
  formattedSubtotal: string;
  fees: FeeVM[];
  discount: Money;
  formattedDiscount: string;
  tax: Money;
  formattedTax: string;
  total: Money;
  formattedTotal: string;
}

export interface OrderLineVM {
  menuItemId: string;
  name: string | null;
  quantity: number;
  unitPrice: Money;
  formattedUnitPrice: string;
  lineTotal: Money;
  formattedLineTotal: string;
}

/** Confirmation line view-model — no `unitPrice` (the order-request DTO omits it). */
export interface OrderRequestLineVM {
  menuItemId: string;
  name: string | null;
  quantity: number;
  lineTotal: Money;
  formattedLineTotal: string;
}

export interface PromotionVM {
  code: string;
  kind: string;
  discount: Money;
  formattedDiscount: string;
  sourceRef: string;
}

export interface CheckoutPreviewVM {
  restaurantId: string;
  lines: OrderLineVM[];
  pricing: PricingVM;
  serviceable: boolean;
  distanceMeters: number;
  deliveryFee: Money;
  formattedDeliveryFee: string;
  minOrder: Money;
  formattedMinOrder: string;
  promotion: PromotionVM | null;
}

export interface OrderConfirmationVM {
  orderRequestId: string;
  customerId: string;
  restaurantId: string;
  restaurantName: string;
  status: "REQUESTED";
  lines: OrderRequestLineVM[];
  pricing: PricingVM;
  deliveryAddress: DeliveryAddressResponse;
  paymentMethod: PaymentMethod;
  idempotencyKey: string;
  schemaVersion: number;
  createdAt: string;
}

function orderLineAdapter(line: OrderLineResponse): OrderLineVM {
  const unitPrice = toMajorMoney(line.unitPrice);
  const lineTotal = toMajorMoney(line.lineTotal);
  return {
    menuItemId: line.menuItemId,
    name: line.name,
    quantity: line.quantity,
    unitPrice,
    formattedUnitPrice: formatMoney(unitPrice),
    lineTotal,
    formattedLineTotal: formatMoney(lineTotal),
  };
}

function orderRequestLineAdapter(line: OrderRequestLineResponse): OrderRequestLineVM {
  const lineTotal = toMajorMoney(line.lineTotal);
  return {
    menuItemId: line.menuItemId,
    name: line.name,
    quantity: line.quantity,
    lineTotal,
    formattedLineTotal: formatMoney(lineTotal),
  };
}

function feeAdapter(fee: FeeResponse): FeeVM {
  const amount = toMajorMoney(fee.amount);
  return { type: fee.type, amount, formattedAmount: formatMoney(amount) };
}

function pricingAdapter(pricing: PricingResponse): PricingVM {
  const subtotal = toMajorMoney(pricing.subtotal);
  const discount = toMajorMoney(pricing.discount);
  const tax = toMajorMoney(pricing.tax);
  const total = toMajorMoney(pricing.total);
  return {
    subtotal,
    formattedSubtotal: formatMoney(subtotal),
    fees: pricing.fees.map(feeAdapter),
    discount,
    formattedDiscount: formatMoney(discount),
    tax,
    formattedTax: formatMoney(tax),
    total,
    formattedTotal: formatMoney(total),
  };
}

function promotionAdapter(promo: PromotionResponse): PromotionVM {
  const discount = toMajorMoney(promo.discount);
  return {
    code: promo.code,
    kind: promo.kind,
    discount,
    formattedDiscount: formatMoney(discount),
    sourceRef: promo.sourceRef,
  };
}

export function checkoutPreviewAdapter(dto: CheckoutPreviewResponseDto): CheckoutPreviewVM {
  const deliveryFee = toMajorMoney(dto.deliveryFee);
  const minOrder = toMajorMoney(dto.minOrder);
  return {
    restaurantId: dto.restaurantId,
    lines: dto.lines.map(orderLineAdapter),
    pricing: pricingAdapter(dto.pricing),
    serviceable: dto.serviceable,
    distanceMeters: dto.distanceMeters,
    deliveryFee,
    formattedDeliveryFee: formatMoney(deliveryFee),
    minOrder,
    formattedMinOrder: formatMoney(minOrder),
    promotion: dto.promotion ? promotionAdapter(dto.promotion) : null,
  };
}

export function orderConfirmationAdapter(dto: OrderRequestSummaryDto): OrderConfirmationVM {
  return {
    orderRequestId: dto.orderRequestId,
    customerId: dto.customerId,
    restaurantId: dto.restaurantId,
    restaurantName: dto.restaurantName,
    status: dto.status,
    lines: dto.lines.map(orderRequestLineAdapter),
    pricing: pricingAdapter(dto.pricing),
    deliveryAddress: dto.deliveryAddress,
    paymentMethod: dto.paymentMethod,
    idempotencyKey: dto.idempotencyKey,
    schemaVersion: dto.schemaVersion,
    createdAt: dto.createdAt,
  };
}
