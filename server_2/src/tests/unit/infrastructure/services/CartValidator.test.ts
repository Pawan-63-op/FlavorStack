import { Cart } from '../../../../domain/commerce/entities/Cart';
import { LineItemSelection } from '../../../../domain/commerce/value-objects/LineItemSelection';
import { Money } from '../../../../domain/shared/Money';
import { CartValidator } from '../../../../infrastructure/services/CartValidator';
import {
  CartCatalogView,
  CartMenuItemView,
  CartVariantGroupView,
} from '../../../../domain/commerce/types/CatalogGatewayRead';
import { VALIDATION_ISSUE_CODE, VALIDATION_SEVERITY } from '../../../../domain/commerce/types/ValidationReport';
import { COMMERCE_RESTAURANT_STATUS } from '../../../../domain/commerce/enums/restaurant-status.enum';
import { COMMERCE_CATALOG_VISIBILITY } from '../../../../domain/commerce/enums/catalog-visibility.enum';

const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

function money(amount: number, currency = 'INR') {
  return Money.create(amount, currency).getValue();
}

function selection(overrides: Partial<{ menuItemId: string; selectedOptionIds: string[]; quantity: number }> = {}) {
  return LineItemSelection.create({
    menuItemId: 'menu-1',
    selectedOptionIds: [],
    quantity: 1,
    ...overrides,
  }).getValue();
}

function buildCart(
  items: Array<{ menuItemId: string; selectedOptionIds?: string[]; quantity?: number; unitPrice?: number }> = []
): Cart {
  const cart = Cart.create('customer-1').getValue();
  for (const item of items) {
    const result = cart.addItem(
      'restaurant-1',
      selection({
        menuItemId: item.menuItemId,
        selectedOptionIds: item.selectedOptionIds ?? [],
        quantity: item.quantity ?? 1,
      }),
      money(item.unitPrice ?? 10000)
    );
    if (result.isFailure) throw new Error(`fixture addItem failed: ${String(result.getError())}`);
  }
  return cart;
}

function buildVariantGroup(overrides: Partial<CartVariantGroupView> = {}): CartVariantGroupView {
  return {
    groupId: 'group-1',
    label: 'Size',
    selectionType: 'SINGLE',
    required: true,
    minSelect: 1,
    maxSelect: 1,
    options: [
      { optionId: 'opt-small', label: 'Small', priceDeltaAmount: 0, currency: 'INR', isDefault: true, isAvailable: true },
      { optionId: 'opt-large', label: 'Large', priceDeltaAmount: 5000, currency: 'INR', isDefault: false, isAvailable: true },
    ],
    ...overrides,
  };
}

function buildMenuItem(overrides: Partial<CartMenuItemView> = {}): CartMenuItemView {
  return {
    menuItemId: 'menu-1',
    restaurantId: 'restaurant-1',
    categoryId: 'cat-1',
    name: 'Burger',
    basePriceAmount: 10000,
    currency: 'INR',
    variantGroups: [],
    isAvailable: true,
    outOfStockReason: null,
    ...overrides,
  };
}

function buildRestaurantView(overrides: Partial<CartCatalogView> = {}): CartCatalogView {
  return {
    restaurantId: 'restaurant-1',
    name: 'Test Restaurant',
    slug: 'test-restaurant',
    status: COMMERCE_RESTAURANT_STATUS.ACTIVE,
    visibility: COMMERCE_CATALOG_VISIBILITY.PUBLIC,
    openingHours: null,
    tzOffsetMinutes: 0,
    deliveryZones: [],
    items: [buildMenuItem()],
    ...overrides,
  };
}

describe('CartValidator', () => {
  const validator = new CartValidator();

  describe('empty cart', () => {
    it('returns a valid, empty report even without a catalog view', () => {
      const cart = Cart.create('customer-1').getValue();

      const result = validator.validate(cart, null);

      expect(result.isSuccess).toBe(true);
      const report = result.getValue();
      expect(report.isValid).toBe(true);
      expect(report.issues).toEqual([]);
    });
  });

  describe('restaurant-level checks', () => {
    it('flags RESTAURANT_NOT_FOUND when the projection has no view for the cart restaurant', () => {
      const cart = buildCart([{ menuItemId: 'menu-1' }]);

      const report = validator.validate(cart, null).getValue();

      expect(report.isValid).toBe(false);
      expect(report.issues).toContainEqual(
        expect.objectContaining({ code: VALIDATION_ISSUE_CODE.RESTAURANT_NOT_FOUND, severity: VALIDATION_SEVERITY.ERROR })
      );
    });

    it('flags RESTAURANT_INACTIVE when restaurant status is not ACTIVE', () => {
      const cart = buildCart([{ menuItemId: 'menu-1' }]);
      const view = buildRestaurantView({ status: COMMERCE_RESTAURANT_STATUS.PAUSED });

      const report = validator.validate(cart, view).getValue();

      expect(report.isValid).toBe(false);
      expect(report.issues).toContainEqual(
        expect.objectContaining({ code: VALIDATION_ISSUE_CODE.RESTAURANT_INACTIVE, severity: VALIDATION_SEVERITY.ERROR })
      );
    });

    it('flags RESTAURANT_NOT_VISIBLE when restaurant visibility is not PUBLIC', () => {
      const cart = buildCart([{ menuItemId: 'menu-1' }]);
      const view = buildRestaurantView({ visibility: COMMERCE_CATALOG_VISIBILITY.HIDDEN });

      const report = validator.validate(cart, view).getValue();

      expect(report.isValid).toBe(false);
      expect(report.issues).toContainEqual(
        expect.objectContaining({ code: VALIDATION_ISSUE_CODE.RESTAURANT_NOT_VISIBLE, severity: VALIDATION_SEVERITY.ERROR })
      );
    });

    it('treats a restaurant with no opening hours configured as always open while active', () => {
      const cart = buildCart([{ menuItemId: 'menu-1' }]);
      const view = buildRestaurantView({ openingHours: null });

      const report = validator.validate(cart, view).getValue();

      expect(report.issues).not.toContainEqual(expect.objectContaining({ code: VALIDATION_ISSUE_CODE.RESTAURANT_CLOSED }));
    });

    it('flags RESTAURANT_CLOSED when today is a configured holiday', () => {
      const cart = buildCart([{ menuItemId: 'menu-1' }]);
      const fullDayOpen = { open: '00:00', close: '23:59' };
      const schedule = Object.fromEntries(WEEKDAYS.map((day) => [day, [fullDayOpen]]));
      const today = new Date().toISOString().slice(0, 10);
      const view = buildRestaurantView({ openingHours: { schedule, holidays: [today] } });

      const report = validator.validate(cart, view).getValue();

      expect(report.isValid).toBe(false);
      expect(report.issues).toContainEqual(
        expect.objectContaining({ code: VALIDATION_ISSUE_CODE.RESTAURANT_CLOSED, severity: VALIDATION_SEVERITY.ERROR })
      );
    });
  });

  describe('item-level checks', () => {
    it('flags ITEM_NOT_FOUND when a cart item is missing from the catalog view', () => {
      const cart = buildCart([{ menuItemId: 'menu-missing' }]);
      const view = buildRestaurantView({ items: [buildMenuItem({ menuItemId: 'menu-1' })] });

      const report = validator.validate(cart, view).getValue();

      expect(report.isValid).toBe(false);
      expect(report.issues).toContainEqual(
        expect.objectContaining({ code: VALIDATION_ISSUE_CODE.ITEM_NOT_FOUND, menuItemId: 'menu-missing', severity: VALIDATION_SEVERITY.ERROR })
      );
    });

    it('flags ITEM_UNAVAILABLE when the menu item is marked unavailable', () => {
      const cart = buildCart([{ menuItemId: 'menu-1' }]);
      const view = buildRestaurantView({
        items: [buildMenuItem({ menuItemId: 'menu-1', isAvailable: false, outOfStockReason: 'sold_out' })],
      });

      const report = validator.validate(cart, view).getValue();

      expect(report.isValid).toBe(false);
      expect(report.issues).toContainEqual(
        expect.objectContaining({ code: VALIDATION_ISSUE_CODE.ITEM_UNAVAILABLE, menuItemId: 'menu-1', severity: VALIDATION_SEVERITY.ERROR })
      );
    });

    it('passes when the selected option satisfies a required variant group', () => {
      const cart = buildCart([{ menuItemId: 'menu-1', selectedOptionIds: ['opt-small'] }]);
      const view = buildRestaurantView({
        items: [buildMenuItem({ menuItemId: 'menu-1', variantGroups: [buildVariantGroup()] })],
      });

      const report = validator.validate(cart, view).getValue();

      expect(report.isValid).toBe(true);
      expect(report.issues).toEqual([]);
    });

    it('flags VARIANT_INVALID when a selected option id does not exist in any variant group', () => {
      const cart = buildCart([{ menuItemId: 'menu-1', selectedOptionIds: ['opt-unknown'] }]);
      const view = buildRestaurantView({
        items: [buildMenuItem({ menuItemId: 'menu-1', variantGroups: [buildVariantGroup()] })],
      });

      const report = validator.validate(cart, view).getValue();

      expect(report.isValid).toBe(false);
      expect(report.issues).toContainEqual(
        expect.objectContaining({ code: VALIDATION_ISSUE_CODE.VARIANT_INVALID, menuItemId: 'menu-1', severity: VALIDATION_SEVERITY.ERROR })
      );
    });

    it('flags VARIANT_INVALID when a selected option is unavailable', () => {
      const cart = buildCart([{ menuItemId: 'menu-1', selectedOptionIds: ['opt-large'] }]);
      const view = buildRestaurantView({
        items: [
          buildMenuItem({
            menuItemId: 'menu-1',
            variantGroups: [
              buildVariantGroup({
                options: [
                  { optionId: 'opt-small', label: 'Small', priceDeltaAmount: 0, currency: 'INR', isDefault: true, isAvailable: true },
                  { optionId: 'opt-large', label: 'Large', priceDeltaAmount: 5000, currency: 'INR', isDefault: false, isAvailable: false },
                ],
              }),
            ],
          }),
        ],
      });

      const report = validator.validate(cart, view).getValue();

      expect(report.isValid).toBe(false);
      expect(report.issues).toContainEqual(
        expect.objectContaining({ code: VALIDATION_ISSUE_CODE.VARIANT_INVALID, menuItemId: 'menu-1', severity: VALIDATION_SEVERITY.ERROR })
      );
    });

    it('flags VARIANT_INVALID when a required variant group has no selection', () => {
      const cart = buildCart([{ menuItemId: 'menu-1', selectedOptionIds: [] }]);
      const view = buildRestaurantView({
        items: [buildMenuItem({ menuItemId: 'menu-1', variantGroups: [buildVariantGroup({ required: true, minSelect: 1, maxSelect: 1 })] })],
      });

      const report = validator.validate(cart, view).getValue();

      expect(report.isValid).toBe(false);
      expect(report.issues).toContainEqual(
        expect.objectContaining({ code: VALIDATION_ISSUE_CODE.VARIANT_INVALID, menuItemId: 'menu-1', severity: VALIDATION_SEVERITY.ERROR })
      );
    });

    it('flags VARIANT_INVALID when selections for a group exceed maxSelect', () => {
      const cart = buildCart([{ menuItemId: 'menu-1', selectedOptionIds: ['opt-small', 'opt-large'] }]);
      const view = buildRestaurantView({
        items: [buildMenuItem({ menuItemId: 'menu-1', variantGroups: [buildVariantGroup({ required: true, minSelect: 1, maxSelect: 1 })] })],
      });

      const report = validator.validate(cart, view).getValue();

      expect(report.isValid).toBe(false);
      expect(report.issues).toContainEqual(
        expect.objectContaining({ code: VALIDATION_ISSUE_CODE.VARIANT_INVALID, menuItemId: 'menu-1', severity: VALIDATION_SEVERITY.ERROR })
      );
    });
  });

  describe('min-order check (best-effort warning)', () => {
    it('flags MIN_ORDER_NOT_MET as a non-blocking warning when subtotal is below every zone minimum', () => {
      const cart = buildCart([{ menuItemId: 'menu-1', unitPrice: 1000, quantity: 1 }]);
      const view = buildRestaurantView({
        deliveryZones: [{ deliveryZoneId: 'zone-1', feeTiers: [], freeAboveSubtotalAmount: null, minOrderAmount: 5000, currency: 'INR' }],
      });

      const report = validator.validate(cart, view).getValue();

      expect(report.isValid).toBe(true);
      expect(report.issues).toContainEqual(
        expect.objectContaining({ code: VALIDATION_ISSUE_CODE.MIN_ORDER_NOT_MET, severity: VALIDATION_SEVERITY.WARNING })
      );
    });

    it('does not flag MIN_ORDER_NOT_MET when the subtotal meets the lowest zone minimum', () => {
      const cart = buildCart([{ menuItemId: 'menu-1', unitPrice: 5000, quantity: 1 }]);
      const view = buildRestaurantView({
        deliveryZones: [{ deliveryZoneId: 'zone-1', feeTiers: [], freeAboveSubtotalAmount: null, minOrderAmount: 5000, currency: 'INR' }],
      });

      const report = validator.validate(cart, view).getValue();

      expect(report.issues).not.toContainEqual(expect.objectContaining({ code: VALIDATION_ISSUE_CODE.MIN_ORDER_NOT_MET }));
    });

    it('does not flag MIN_ORDER_NOT_MET when the restaurant has no delivery zones', () => {
      const cart = buildCart([{ menuItemId: 'menu-1', unitPrice: 1000, quantity: 1 }]);
      const view = buildRestaurantView({ deliveryZones: [] });

      const report = validator.validate(cart, view).getValue();

      expect(report.issues).not.toContainEqual(expect.objectContaining({ code: VALIDATION_ISSUE_CODE.MIN_ORDER_NOT_MET }));
    });
  });

  describe('multi-issue reports', () => {
    it('collects issues across restaurant and item checks in a single report', () => {
      const cart = buildCart([{ menuItemId: 'menu-1' }, { menuItemId: 'menu-missing' }]);
      const view = buildRestaurantView({
        status: COMMERCE_RESTAURANT_STATUS.PAUSED,
        items: [buildMenuItem({ menuItemId: 'menu-1' })],
      });

      const report = validator.validate(cart, view).getValue();

      expect(report.isValid).toBe(false);
      expect(report.issues).toContainEqual(expect.objectContaining({ code: VALIDATION_ISSUE_CODE.RESTAURANT_INACTIVE }));
      expect(report.issues).toContainEqual(expect.objectContaining({ code: VALIDATION_ISSUE_CODE.ITEM_NOT_FOUND, menuItemId: 'menu-missing' }));
    });
  });
});
