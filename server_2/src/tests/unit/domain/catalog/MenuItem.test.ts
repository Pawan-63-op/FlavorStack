import { MenuItem } from '../../../../domain/catalog/entities/MenuItem';
import { ItemVariantGroup } from '../../../../domain/catalog/entities/ItemVariantGroup';
import { ItemOption } from '../../../../domain/catalog/entities/ItemOption';
import { CreateMenuItemInput } from '../../../../domain/catalog/types/CreateMenuItemInput';
import { Money } from '../../../../domain/shared/Money';
import { ItemAvailability } from '../../../../domain/catalog/value-objects/ItemAvailability.vo';
import { DIETARY_TAG } from '../../../../domain/catalog/enums/dietary-tag.enum';
import { VARIANT_SELECTION_TYPE } from '../../../../domain/catalog/enums/variant-selection-type.enum';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';
import { ConflictError } from '../../../../domain/shared/errors/ConflictError';

import { MenuItemCreated } from '../../../../domain/catalog/events/MenuItemCreated';
import { MenuItemUpdated } from '../../../../domain/catalog/events/MenuItemUpdated';
import { MenuItemAvailabilityChanged } from '../../../../domain/catalog/events/MenuItemAvailabilityChanged';

function buildInput(overrides: Partial<CreateMenuItemInput> = {}): CreateMenuItemInput {
  return {
    restaurantId: 'rest-1',
    categoryId: 'cat-1',
    name: 'Paneer Tikka',
    description: 'Smoky cottage cheese starter',
    basePrice: Money.create(25000).getValue(),
    ...overrides,
  };
}

describe('MenuItem aggregate', () => {
  describe('create', () => {
    it('creates a valid menu item with defaults', () => {
      const result = MenuItem.create(buildInput());
      expect(result.isSuccess).toBe(true);

      const item = result.getValue();
      expect(item.restaurantId).toBe('rest-1');
      expect(item.categoryId).toBe('cat-1');
      expect(item.name).toBe('Paneer Tikka');
      expect(item.basePrice.amount).toBe(25000);
      expect(item.tags).toEqual([]);
      expect(item.dietary).toEqual([]);
      expect(item.availability.isAvailable).toBe(true);
      expect(item.version).toBe(0);
      expect(item.deletedAt).toBeNull();
    });

    it('raises a MenuItemCreated event', () => {
      const item = MenuItem.create(buildInput()).getValue();
      const events = item.pullDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(MenuItemCreated);
      expect(events[0].aggregateId).toBe(item.id.toString());
    });

    it('accepts tags and dietary on create', () => {
      const item = MenuItem.create(
        buildInput({ tags: ['spicy', 'starter'], dietary: [DIETARY_TAG.VEG] })
      ).getValue();

      expect(item.tags).toEqual(['spicy', 'starter']);
      expect(item.dietary).toEqual([DIETARY_TAG.VEG]);
    });

    it('rejects an empty name', () => {
      const result = MenuItem.create(buildInput({ name: '   ' }));
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('rejects an empty restaurantId', () => {
      const result = MenuItem.create(buildInput({ restaurantId: '' }));
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('rejects an empty categoryId', () => {
      const result = MenuItem.create(buildInput({ categoryId: '' }));
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('rejects a basePrice that is not a Money value object', () => {
      const result = MenuItem.create(buildInput({ basePrice: { amount: 100 } as any }));
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('rejects an invalid dietary tag', () => {
      const result = MenuItem.create(buildInput({ dietary: ['DESSERT'] as any }));
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });
  });

  describe('updateDetails', () => {
    it('updates name, description, imageUrl, tags and dietary, raising MenuItemUpdated', () => {
      const item = MenuItem.create(buildInput()).getValue();
      item.pullDomainEvents();

      const result = item.updateDetails({
        name: 'Paneer Tikka Masala',
        description: 'Updated description',
        imageUrl: 'https://example.com/img.png',
        tags: ['bestseller'],
        dietary: [DIETARY_TAG.VEG],
      });

      expect(result.isSuccess).toBe(true);
      expect(item.name).toBe('Paneer Tikka Masala');
      expect(item.description).toBe('Updated description');
      expect(item.imageUrl).toBe('https://example.com/img.png');
      expect(item.tags).toEqual(['bestseller']);
      expect(item.dietary).toEqual([DIETARY_TAG.VEG]);
      expect(item.version).toBe(1);

      const events = item.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(MenuItemUpdated);
      expect((events[0] as MenuItemUpdated).changedFields).toEqual(
        expect.arrayContaining(['name', 'description', 'imageUrl', 'tags', 'dietary'])
      );
    });

    it('rejects an empty name on update and leaves state unchanged', () => {
      const item = MenuItem.create(buildInput()).getValue();
      item.pullDomainEvents();

      const result = item.updateDetails({ name: '   ' });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
      expect(item.name).toBe('Paneer Tikka');
      expect(item.version).toBe(0);
      expect(item.pullDomainEvents()).toHaveLength(0);
    });

    it('rejects an invalid dietary tag on update', () => {
      const item = MenuItem.create(buildInput()).getValue();
      item.pullDomainEvents();

      const result = item.updateDetails({ dietary: ['DESSERT'] as any });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
      expect(item.dietary).toEqual([]);
    });

    it('is a no-op when no changes are provided', () => {
      const item = MenuItem.create(buildInput()).getValue();
      item.pullDomainEvents();

      const result = item.updateDetails({});

      expect(result.isSuccess).toBe(true);
      expect(item.version).toBe(0);
      expect(item.pullDomainEvents()).toHaveLength(0);
    });
  });

  describe('changePrice', () => {
    it('updates basePrice and raises MenuItemUpdated', () => {
      const item = MenuItem.create(buildInput()).getValue();
      item.pullDomainEvents();

      const newPrice = Money.create(30000).getValue();
      const result = item.changePrice(newPrice);

      expect(result.isSuccess).toBe(true);
      expect(item.basePrice.amount).toBe(30000);
      expect(item.version).toBe(1);

      const events = item.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(MenuItemUpdated);
      expect((events[0] as MenuItemUpdated).changedFields).toEqual(['basePrice']);
    });

    it('rejects a value that is not a Money instance', () => {
      const item = MenuItem.create(buildInput()).getValue();

      const result = item.changePrice({ amount: 100 } as any);

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
      expect(item.basePrice.amount).toBe(25000);
    });

    it('is a no-op when the price is unchanged', () => {
      const item = MenuItem.create(buildInput()).getValue();
      item.pullDomainEvents();

      const samePrice = Money.create(25000).getValue();
      const result = item.changePrice(samePrice);

      expect(result.isSuccess).toBe(true);
      expect(item.version).toBe(0);
      expect(item.pullDomainEvents()).toHaveLength(0);
    });
  });

  describe('assignCategory', () => {
    it('reassigns the category and raises MenuItemUpdated', () => {
      const item = MenuItem.create(buildInput()).getValue();
      item.pullDomainEvents();

      const result = item.assignCategory('cat-2');

      expect(result.isSuccess).toBe(true);
      expect(item.categoryId).toBe('cat-2');
      expect(item.version).toBe(1);

      const events = item.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(MenuItemUpdated);
      expect((events[0] as MenuItemUpdated).changedFields).toEqual(['categoryId']);
    });

    it('rejects an empty categoryId', () => {
      const item = MenuItem.create(buildInput()).getValue();

      const result = item.assignCategory('   ');

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
      expect(item.categoryId).toBe('cat-1');
    });

    it('is a no-op when the category is unchanged', () => {
      const item = MenuItem.create(buildInput()).getValue();
      item.pullDomainEvents();

      const result = item.assignCategory('cat-1');

      expect(result.isSuccess).toBe(true);
      expect(item.version).toBe(0);
      expect(item.pullDomainEvents()).toHaveLength(0);
    });
  });

  describe('toggleAvailability', () => {
    it('marks the item unavailable with a reason and raises MenuItemAvailabilityChanged', () => {
      const item = MenuItem.create(buildInput()).getValue();
      item.pullDomainEvents();

      const unavailable = ItemAvailability.create({ isAvailable: false, outOfStockReason: 'Sold out' }).getValue();
      const result = item.toggleAvailability(unavailable);

      expect(result.isSuccess).toBe(true);
      expect(item.availability.isAvailable).toBe(false);
      expect(item.availability.outOfStockReason).toBe('Sold out');
      expect(item.version).toBe(1);

      const events = item.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(MenuItemAvailabilityChanged);
      const event = events[0] as MenuItemAvailabilityChanged;
      expect(event.aggregateId).toBe(item.id.toString());
      expect(event.restaurantId).toBe('rest-1');
      expect(event.isAvailable).toBe(false);
      expect(event.outOfStockReason).toBe('Sold out');
    });

    it('marks the item available again', () => {
      const item = MenuItem.create(buildInput()).getValue();
      item.toggleAvailability(ItemAvailability.create({ isAvailable: false, outOfStockReason: 'Sold out' }).getValue());
      item.pullDomainEvents();

      const available = ItemAvailability.create({ isAvailable: true }).getValue();
      const result = item.toggleAvailability(available);

      expect(result.isSuccess).toBe(true);
      expect(item.availability.isAvailable).toBe(true);
      expect(item.version).toBe(2);

      const events = item.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect((events[0] as MenuItemAvailabilityChanged).isAvailable).toBe(true);
    });

    it('rejects a value that is not an ItemAvailability instance', () => {
      const item = MenuItem.create(buildInput()).getValue();

      const result = item.toggleAvailability({ isAvailable: false } as any);

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });
  });

  describe('setItemVariants', () => {
    function buildSizeGroup() {
      const small = ItemOption.create({ label: 'Small', priceDelta: Money.create(0).getValue(), isDefault: true }).getValue();
      const large = ItemOption.create({ label: 'Large', priceDelta: Money.create(5000).getValue() }).getValue();
      return ItemVariantGroup.create({
        label: 'Size',
        selectionType: VARIANT_SELECTION_TYPE.SINGLE,
        required: true,
        minSelect: 1,
        maxSelect: 1,
        options: [small, large],
      }).getValue();
    }

    function buildAddOnsGroup() {
      const cheese = ItemOption.create({ label: 'Cheese', priceDelta: Money.create(2000).getValue() }).getValue();
      const olives = ItemOption.create({ label: 'Olives', priceDelta: Money.create(1500).getValue() }).getValue();
      return ItemVariantGroup.create({
        label: 'Add-ons',
        selectionType: VARIANT_SELECTION_TYPE.MULTI,
        required: false,
        minSelect: 0,
        maxSelect: 2,
        options: [cheese, olives],
      }).getValue();
    }

    it('sets variant groups and raises MenuItemUpdated', () => {
      const item = MenuItem.create(buildInput()).getValue();
      item.pullDomainEvents();

      const groups = [buildSizeGroup(), buildAddOnsGroup()];
      const result = item.setItemVariants(groups);

      expect(result.isSuccess).toBe(true);
      expect(item.variantGroups).toHaveLength(2);
      expect(item.version).toBe(1);

      const events = item.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect((events[0] as any).changedFields).toEqual(['variantGroups']);
    });

    it('rejects a non-array value', () => {
      const item = MenuItem.create(buildInput()).getValue();
      const result = item.setItemVariants('nope' as any);
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('rejects when a required group has zero available options', () => {
      const item = MenuItem.create(buildInput()).getValue();

      const unavailable = ItemOption.create({
        label: 'Small',
        priceDelta: Money.create(0).getValue(),
        isAvailable: false,
      }).getValue();
      const group = ItemVariantGroup.create({
        label: 'Size',
        selectionType: VARIANT_SELECTION_TYPE.SINGLE,
        required: true,
        minSelect: 1,
        maxSelect: 1,
        options: [unavailable],
      }).getValue();

      const result = item.setItemVariants([group]);
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
      expect(item.variantGroups).toEqual([]);
    });
  });

  describe('priceFor', () => {
    function itemWithVariants() {
      const item = MenuItem.create(buildInput()).getValue();

      const small = ItemOption.create({ label: 'Small', priceDelta: Money.create(0).getValue(), isDefault: true });
      const large = ItemOption.create({ label: 'Large', priceDelta: Money.create(5000).getValue() });
      const unavailableXl = ItemOption.create({
        label: 'XL',
        priceDelta: Money.create(8000).getValue(),
        isAvailable: false,
      });
      const sizeGroup = ItemVariantGroup.create({
        label: 'Size',
        selectionType: VARIANT_SELECTION_TYPE.SINGLE,
        required: true,
        minSelect: 1,
        maxSelect: 1,
        options: [small.getValue(), large.getValue(), unavailableXl.getValue()],
      }).getValue();

      const cheese = ItemOption.create({ label: 'Cheese', priceDelta: Money.create(2000).getValue() });
      const olives = ItemOption.create({ label: 'Olives', priceDelta: Money.create(1500).getValue() });
      const addOnsGroup = ItemVariantGroup.create({
        label: 'Add-ons',
        selectionType: VARIANT_SELECTION_TYPE.MULTI,
        required: false,
        minSelect: 0,
        maxSelect: 2,
        options: [cheese.getValue(), olives.getValue()],
      }).getValue();

      item.setItemVariants([sizeGroup, addOnsGroup]);

      return {
        item,
        smallId: sizeGroup.options[0].id.toString(),
        largeId: sizeGroup.options[1].id.toString(),
        xlId: sizeGroup.options[2].id.toString(),
        cheeseId: addOnsGroup.options[0].id.toString(),
        olivesId: addOnsGroup.options[1].id.toString(),
      };
    }

    it('returns the basePrice when there are no variant groups', () => {
      const item = MenuItem.create(buildInput()).getValue();
      const result = item.priceFor([]);
      expect(result.isSuccess).toBe(true);
      expect(result.getValue().amount).toBe(25000);
    });

    it('resolves the price for a single selected size option', () => {
      const { item, largeId } = itemWithVariants();
      const result = item.priceFor([largeId]);
      expect(result.isSuccess).toBe(true);
      expect(result.getValue().amount).toBe(25000 + 5000);
    });

    it('resolves the price across multiple variant groups', () => {
      const { item, largeId, cheeseId, olivesId } = itemWithVariants();
      const result = item.priceFor([largeId, cheeseId, olivesId]);
      expect(result.isSuccess).toBe(true);
      expect(result.getValue().amount).toBe(25000 + 5000 + 2000 + 1500);
    });

    it('resolves the price when only the required group is selected', () => {
      const { item, smallId } = itemWithVariants();
      const result = item.priceFor([smallId]);
      expect(result.isSuccess).toBe(true);
      expect(result.getValue().amount).toBe(25000);
    });

    it('rejects when the required size group has no selection', () => {
      const { item, cheeseId } = itemWithVariants();
      const result = item.priceFor([cheeseId]);
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('rejects when more options than maxSelect are chosen for a group', () => {
      const { item, smallId, largeId } = itemWithVariants();
      const result = item.priceFor([smallId, largeId]);
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('rejects when an unavailable option is selected', () => {
      const { item, xlId } = itemWithVariants();
      const result = item.priceFor([xlId]);
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('rejects an unknown option id', () => {
      const { item, smallId } = itemWithVariants();
      const result = item.priceFor([smallId, 'does-not-exist']);
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });
  });

  describe('softDelete', () => {
    it('sets deletedAt and increments version', () => {
      const item = MenuItem.create(buildInput()).getValue();
      item.pullDomainEvents();

      const result = item.softDelete();

      expect(result.isSuccess).toBe(true);
      expect(item.deletedAt).toBeInstanceOf(Date);
      expect(item.version).toBe(1);
    });

    it('rejects a second soft delete', () => {
      const item = MenuItem.create(buildInput()).getValue();
      item.softDelete();

      const result = item.softDelete();

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ConflictError);
    });
  });
});
