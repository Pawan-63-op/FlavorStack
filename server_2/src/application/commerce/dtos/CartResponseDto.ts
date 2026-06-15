// Output DTO: CartView — the customer's active Cart, with each line's unit price
// and computed line total. `validation` (Phase 6) is the ICartValidator report
// against the commerce_catalog_view local projection. Each line is additionally
// enriched (Phase 13) with the current name/price/availability read from the same
// commerce_catalog_view projection, so the customer sees live catalog data without
// the cart-cached snapshot going stale.
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

// Per-line enrichment derived on read from the commerce_catalog_view projection.
// `name`/`currentUnitPrice` are null when the item is no longer in the projection
// (removed/unprojected); `isAvailable` is then false. `currentUnitPrice` is the
// live base price plus the deltas of the selected variant options — what the line
// would cost now, independent of the cart-cached `unitPriceSnapshot`.
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

// Pure: derive a line's live name/price/availability from the projected restaurant
// view. Returns an "absent" enrichment (null name/price, unavailable) when the item
// is no longer projected. currentUnitPrice = basePrice + Σ priceDelta of the selected
// options; availability requires the item and every selected option to be available.
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
