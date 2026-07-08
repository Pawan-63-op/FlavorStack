import { Cart } from '../../../domain/commerce/entities/Cart';
import { CartItem } from '../../../domain/commerce/entities/CartItem';
import { Money } from '../../../domain/shared/Money';
import { ValidationReport } from '../../../domain/commerce/types/ValidationReport';
import { CommerceCatalogRestaurantView } from '../../../domain/commerce/types/CommerceCatalogView';

export interface MoneyResponse {
  amount: number;
  currency: string;
}

export interface AppliedPromotionResponse {
  code: string;
  kind: string;
  discount: MoneyResponse;
  sourceRef: string;
}

export interface CartItemEnrichment {
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
  enrichment?: CartItemEnrichment;
}

export interface CartResponseDto {
  id: string;
  customerId: string;
  restaurantId: string | null;
  items: CartItemResponse[];
  currency: string | null;
  appliedPromotion: AppliedPromotionResponse | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  validation?: ValidationReport;
}

function toMoneyResponse(money: Money): MoneyResponse {
  return { amount: money.amount, currency: money.currency };
}

export function toAppliedPromotionResponse(cart: Cart): AppliedPromotionResponse | null {
  const promo = cart.appliedPromotion;
  if (!promo) return null;
  return {
    code: promo.code,
    kind: promo.kind,
    discount: toMoneyResponse(promo.discount),
    sourceRef: promo.sourceRef,
  };
}

export function enrichCartItem(
  item: CartItem,
  view: CommerceCatalogRestaurantView | null
): CartItemEnrichment {
  const projected = view?.items.find((i) => i.menuItemId === item.menuItemId) ?? null;
  if (!projected) {
    return { name: null, currentUnitPrice: null, isAvailable: false };
  }

  const options = projected.variantGroups
    .flatMap((g) => g.options)
    .filter((o) => item.selectedOptionIds.includes(o.optionId));

  const currentAmount =
    projected.basePriceAmount + options.reduce((sum, o) => sum + o.priceDeltaAmount, 0);

  return {
    name: projected.name,
    currentUnitPrice: { amount: currentAmount, currency: projected.currency },
    isAvailable: projected.isAvailable && options.every((o) => o.isAvailable),
  };
}

export function toCartResponse(
  cart: Cart,
  validation?: ValidationReport,
  view?: CommerceCatalogRestaurantView | null
): CartResponseDto {
  const enrich = view !== undefined;
  return {
    id: cart.id.toString(),
    customerId: cart.customerId,
    restaurantId: cart.restaurantId,
    items: cart.items.map((item) => ({
      id: item.id.toString(),
      menuItemId: item.menuItemId,
      selectedOptionIds: item.selectedOptionIds,
      quantity: item.quantity.value,
      unitPriceSnapshot: toMoneyResponse(item.unitPriceSnapshot),
      lineTotal: toMoneyResponse(item.lineTotal()),
      ...(enrich ? { enrichment: enrichCartItem(item, view ?? null) } : {}),
    })),
    currency: cart.currency,
    appliedPromotion: toAppliedPromotionResponse(cart),
    version: cart.version,
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
    ...(validation ? { validation } : {}),
  };
}
