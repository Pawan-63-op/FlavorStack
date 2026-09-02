import { Result } from '../../domain/shared/Result';
import { Money } from '../../domain/shared/Money';
import { Cart } from '../../domain/commerce/entities/Cart';
import { CartItem } from '../../domain/commerce/entities/CartItem';
import { ICartValidator } from '../../domain/commerce/services/ICartValidator';
import {
  CartCatalogView,
  CartMenuItemView,
  CartOpeningHoursView,
} from '../../domain/commerce/types/CatalogGatewayRead';
import {
  ValidationIssue,
  ValidationReport,
  VALIDATION_ISSUE_CODE,
  VALIDATION_SEVERITY,
} from '../../domain/commerce/types/ValidationReport';
import { COMMERCE_RESTAURANT_STATUS } from '../../domain/commerce/enums/restaurant-status.enum';
import { COMMERCE_CATALOG_VISIBILITY } from '../../domain/commerce/enums/catalog-visibility.enum';

const WEEKDAY_BY_INDEX = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** A restaurant with no opening hours configured is treated as always-open while active. */
function isOpenNow(openingHours: CartOpeningHoursView | null, tzOffsetMinutes: number, at: Date): boolean {
  if (!openingHours) return true;

  const local = new Date(at.getTime() + tzOffsetMinutes * 60_000);
  const dateStr = local.toISOString().slice(0, 10);
  if (openingHours.holidays.includes(dateStr)) return false;

  const weekday = WEEKDAY_BY_INDEX[local.getUTCDay()];
  const minutesOfDay = local.getUTCHours() * 60 + local.getUTCMinutes();
  const intervals = openingHours.schedule[weekday] ?? [];

  return intervals.some((interval) => minutesOfDay >= toMinutes(interval.open) && minutesOfDay < toMinutes(interval.close));
}

function validateVariants(item: CartItem, menuItemView: CartMenuItemView, cartItemId: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const selectedOptionIds = item.selectedOptionIds;

  for (const optionId of selectedOptionIds) {
    const group = menuItemView.variantGroups.find((g) => g.options.some((o) => o.optionId === optionId));
    const option = group?.options.find((o) => o.optionId === optionId);

    if (!option) {
      issues.push({
        code: VALIDATION_ISSUE_CODE.VARIANT_INVALID,
        severity: VALIDATION_SEVERITY.ERROR,
        message: `Selected option "${optionId}" does not exist on menu item "${item.menuItemId}"`,
        cartItemId,
        menuItemId: item.menuItemId,
      });
    } else if (!option.isAvailable) {
      issues.push({
        code: VALIDATION_ISSUE_CODE.VARIANT_INVALID,
        severity: VALIDATION_SEVERITY.ERROR,
        message: `Selected option "${optionId}" on menu item "${item.menuItemId}" is no longer available`,
        cartItemId,
        menuItemId: item.menuItemId,
      });
    }
  }

  for (const group of menuItemView.variantGroups) {
    const selectedInGroup = selectedOptionIds.filter((id) => group.options.some((o) => o.optionId === id)).length;

    if (selectedInGroup < group.minSelect || selectedInGroup > group.maxSelect) {
      issues.push({
        code: VALIDATION_ISSUE_CODE.VARIANT_INVALID,
        severity: VALIDATION_SEVERITY.ERROR,
        message: `Variant group "${group.label}" on menu item "${item.menuItemId}" requires between ${group.minSelect} and ${group.maxSelect} selection(s), got ${selectedInGroup}`,
        cartItemId,
        menuItemId: item.menuItemId,
      });
    }
  }

  return issues;
}

function validateItem(item: CartItem, view: CartCatalogView): ValidationIssue[] {
  const cartItemId = item.id.toString();
  const menuItemView = view.items.find((i) => i.menuItemId === item.menuItemId);

  if (!menuItemView) {
    return [
      {
        code: VALIDATION_ISSUE_CODE.ITEM_NOT_FOUND,
        severity: VALIDATION_SEVERITY.ERROR,
        message: `Menu item "${item.menuItemId}" was not found for this restaurant`,
        cartItemId,
        menuItemId: item.menuItemId,
      },
    ];
  }

  const issues: ValidationIssue[] = [];

  if (!menuItemView.isAvailable) {
    issues.push({
      code: VALIDATION_ISSUE_CODE.ITEM_UNAVAILABLE,
      severity: VALIDATION_SEVERITY.ERROR,
      message: menuItemView.outOfStockReason ?? `Menu item "${item.menuItemId}" is currently unavailable`,
      cartItemId,
      menuItemId: item.menuItemId,
    });
  }

  issues.push(...validateVariants(item, menuItemView, cartItemId));

  return issues;
}

function validateRestaurant(view: CartCatalogView, at: Date): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (view.status !== COMMERCE_RESTAURANT_STATUS.ACTIVE) {
    issues.push({
      code: VALIDATION_ISSUE_CODE.RESTAURANT_INACTIVE,
      severity: VALIDATION_SEVERITY.ERROR,
      message: `Restaurant "${view.restaurantId}" is not active (status: ${view.status})`,
    });
  }

  if (view.visibility !== COMMERCE_CATALOG_VISIBILITY.PUBLIC) {
    issues.push({
      code: VALIDATION_ISSUE_CODE.RESTAURANT_NOT_VISIBLE,
      severity: VALIDATION_SEVERITY.ERROR,
      message: `Restaurant "${view.restaurantId}" is not publicly visible (visibility: ${view.visibility})`,
    });
  }

  if (!isOpenNow(view.openingHours, view.tzOffsetMinutes, at)) {
    issues.push({
      code: VALIDATION_ISSUE_CODE.RESTAURANT_CLOSED,
      severity: VALIDATION_SEVERITY.ERROR,
      message: `Restaurant "${view.restaurantId}" is currently closed`,
    });
  }

  return issues;
}

/** Best-effort: compares cart subtotal against the lowest minOrderAmount across the restaurant's
 *  delivery zones in the cart's currency. The authoritative, address-specific check runs at
 *  checkout via the ICatalogGateway ACL. */
function validateMinOrder(cart: Cart, view: CartCatalogView): ValidationIssue[] {
  if (view.deliveryZones.length === 0 || cart.currency === null) return [];

  const matchingZones = view.deliveryZones.filter((zone) => zone.currency === cart.currency);
  if (matchingZones.length === 0) return [];

  const minRequired = Math.min(...matchingZones.map((zone) => zone.minOrderAmount));

  const subtotal = cart.items.reduce((total, item) => total.add(item.lineTotal()).getValue(), Money.create(0, cart.currency).getValue());

  if (subtotal.amount < minRequired) {
    return [
      {
        code: VALIDATION_ISSUE_CODE.MIN_ORDER_NOT_MET,
        severity: VALIDATION_SEVERITY.WARNING,
        message: `Cart subtotal is below the restaurant's minimum order amount; this may be rejected at checkout`,
      },
    ];
  }

  return [];
}

export class CartValidator implements ICartValidator {
  validate(cart: Cart, catalogView: CartCatalogView | null, at: Date = new Date()): Result<ValidationReport> {
    if (cart.isEmpty) {
      return Result.ok<ValidationReport>({ isValid: true, issues: [] });
    }

    if (!catalogView) {
      return Result.ok<ValidationReport>({
        isValid: false,
        issues: [
          {
            code: VALIDATION_ISSUE_CODE.RESTAURANT_NOT_FOUND,
            severity: VALIDATION_SEVERITY.ERROR,
            message: `No catalog data found for restaurant "${cart.restaurantId}"`,
          },
        ],
      });
    }

    const issues: ValidationIssue[] = [
      ...validateRestaurant(catalogView, at),
      ...cart.items.flatMap((item) => validateItem(item, catalogView)),
      ...validateMinOrder(cart, catalogView),
    ];

    const isValid = !issues.some((issue) => issue.severity === VALIDATION_SEVERITY.ERROR);

    return Result.ok<ValidationReport>({ isValid, issues });
  }
}
