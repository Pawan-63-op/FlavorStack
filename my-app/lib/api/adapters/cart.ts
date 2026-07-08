import { formatMoney, type Money } from "../format/money";

/**
 * server_2 cart DTO → app cart view-model.
 *
 * Mapping source: `my-app/integration_phases/Phase_5.md` (verified server_2
 * contracts) — implemented in Phase 5 (server-side cart + promotions).
 *
 * Money amounts on the wire are integer minor units (paise/cents); `toMajorMoney`
 * is the single place this DTO's money fields are converted to major units for
 * display, mirroring the convention in `adapters/menu.ts` / `services/catalog.ts`.
 */
export interface MoneyResponse {
  amount: number;
  currency: string;
}

export interface CartItemEnrichmentResponse {
  name: string | null;
  currentUnitPrice: MoneyResponse | null;
  isAvailable: boolean;
}

export interface CartItemResponse {
  id: string;
  menuItemId: string;
  selectedOptionIds: string[];
  quantity: number;
  unitPriceSnapshot: MoneyResponse;
  lineTotal: MoneyResponse;
  enrichment?: CartItemEnrichmentResponse;
}

export interface AppliedPromotionResponse {
  code: string;
  kind: string;
  discount: MoneyResponse;
  sourceRef: string;
}

export interface CartResponseDto {
  id: string;
  customerId: string;
  restaurantId: string | null;
  items: CartItemResponse[];
  currency: string | null;
  appliedPromotion: AppliedPromotionResponse | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  /** Phase 6 (server-side); always optional here. */
  validation?: unknown;
}

export interface CartSummaryResponse {
  cartId: string | null;
  itemCount: number;
  total: MoneyResponse | null;
  currency: string | null;
}

export interface ValidatePromotionResponseDto {
  applicable: boolean;
  promotion: AppliedPromotionResponse;
}

export interface CartLineVM {
  cartItemId: string;
  menuItemId: string;
  name: string | null;
  selectedOptionIds: string[];
  quantity: number;
  unitPrice: Money;
  formattedUnitPrice: string;
  lineTotal: Money;
  formattedLineTotal: string;
  isAvailable: boolean;
}

export interface PromotionVM {
  code: string;
  kind: string;
  discount: Money;
  formattedDiscount: string;
  sourceRef: string;
}

export interface CartViewModel {
  id: string;
  restaurantId: string | null;
  currency: string | null;
  version: number;
  items: CartLineVM[];
  appliedPromotion: PromotionVM | null;
  subtotal: Money;
  formattedSubtotal: string;
  total: Money;
  formattedTotal: string;
  validation?: unknown;
}

export interface CartSummaryVM {
  cartId: string | null;
  itemCount: number;
  total: Money | null;
  formattedTotal: string;
  currency: string | null;
}

export function toMajorMoney(money: MoneyResponse): Money {
  return { amount: money.amount / 100, currency: money.currency };
}

function toMajorMoneyNullable(money: MoneyResponse | null): Money | null {
  return money ? toMajorMoney(money) : null;
}

function cartLineAdapter(item: CartItemResponse): CartLineVM {
  const unitPrice = toMajorMoney(item.unitPriceSnapshot);
  const lineTotal = toMajorMoney(item.lineTotal);
  return {
    cartItemId: item.id,
    menuItemId: item.menuItemId,
    name: item.enrichment?.name ?? null,
    selectedOptionIds: item.selectedOptionIds,
    quantity: item.quantity,
    unitPrice,
    formattedUnitPrice: formatMoney(unitPrice),
    lineTotal,
    formattedLineTotal: formatMoney(lineTotal),
    isAvailable: item.enrichment?.isAvailable ?? true,
  };
}

export function promotionAdapter(promo: AppliedPromotionResponse): PromotionVM {
  const discount = toMajorMoney(promo.discount);
  return {
    code: promo.code,
    kind: promo.kind,
    discount,
    formattedDiscount: formatMoney(discount),
    sourceRef: promo.sourceRef,
  };
}

export function cartAdapter(dto: CartResponseDto): CartViewModel {
  const items = dto.items.map(cartLineAdapter);
  const currency = dto.currency ?? items[0]?.lineTotal.currency ?? null;

  const subtotalMinor = dto.items.reduce((sum, item) => sum + item.lineTotal.amount, 0);
  const discountMinor = dto.appliedPromotion?.discount.amount ?? 0;
  const subtotal: Money = { amount: subtotalMinor / 100, currency };
  const total: Money = { amount: (subtotalMinor - discountMinor) / 100, currency };

  return {
    id: dto.id,
    restaurantId: dto.restaurantId,
    currency: dto.currency,
    version: dto.version,
    items,
    appliedPromotion: dto.appliedPromotion ? promotionAdapter(dto.appliedPromotion) : null,
    subtotal,
    formattedSubtotal: formatMoney(subtotal),
    total,
    formattedTotal: formatMoney(total),
    ...(dto.validation !== undefined ? { validation: dto.validation } : {}),
  };
}

export function cartSummaryAdapter(dto: CartSummaryResponse): CartSummaryVM {
  const total = toMajorMoneyNullable(dto.total);
  return {
    cartId: dto.cartId,
    itemCount: dto.itemCount,
    total,
    formattedTotal: formatMoney(total),
    currency: dto.currency,
  };
}
