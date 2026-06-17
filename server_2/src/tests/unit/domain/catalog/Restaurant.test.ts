import { Restaurant } from '../../../../domain/catalog/entities/Restaurant';
import { CreateRestaurantInput } from '../../../../domain/catalog/types/CreateRestaurantInput';
import { Address } from '../../../../domain/identity/value-objects/Address.vo';
import { GeoPoint } from '../../../../domain/identity/value-objects/GeoPoint.vo';
import { GeoPolygon } from '../../../../domain/catalog/value-objects/GeoPolygon.vo';
import { DeliveryFeeMatrix } from '../../../../domain/catalog/value-objects/DeliveryFeeMatrix.vo';
import { OpeningHours, WeeklySchedule } from '../../../../domain/catalog/value-objects/OpeningHours.vo';
import { CatalogVisibility } from '../../../../domain/catalog/value-objects/CatalogVisibility.vo';
import { Money } from '../../../../domain/shared/Money';
import { CUISINE_TYPE } from '../../../../domain/catalog/enums/cuisine-type.enum';
import { RESTAURANT_STATUS } from '../../../../domain/catalog/enums/restaurant-status.enum';
import { CATALOG_VISIBILITY } from '../../../../domain/catalog/enums/catalog-visibility.enum';
import { WEEKDAY } from '../../../../domain/catalog/enums/weekday.enum';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';

import { RestaurantCreated } from '../../../../domain/catalog/events/RestaurantCreated';
import { RestaurantUpdated } from '../../../../domain/catalog/events/RestaurantUpdated';
import { RestaurantStatusChanged } from '../../../../domain/catalog/events/RestaurantStatusChanged';
import { CategoryAdded } from '../../../../domain/catalog/events/CategoryAdded';
import { CategoryUpdated } from '../../../../domain/catalog/events/CategoryUpdated';
import { DeliveryZoneChanged } from '../../../../domain/catalog/events/DeliveryZoneChanged';

function buildAddress() {
  return Address.create({
    street: '12 MG Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    pinCode: '560001',
    coordinates: GeoPoint.create(12.97, 77.59).getValue(),
  }).getValue();
}

function buildInput(overrides: Partial<CreateRestaurantInput> = {}): CreateRestaurantInput {
  return {
    ownerId: 'owner-1',
    name: 'Spice Garden',
    cuisineTypes: [CUISINE_TYPE.NORTH_INDIAN],
    address: buildAddress(),
    location: GeoPoint.create(12.97, 77.59).getValue(),
    phone: '+919876543210',
    ...overrides,
  };
}

function buildPolygon(offset = 0) {
  return GeoPolygon.create([
    GeoPoint.create(0 + offset, 0 + offset).getValue(),
    GeoPoint.create(0 + offset, 1 + offset).getValue(),
    GeoPoint.create(1 + offset, 1 + offset).getValue(),
    GeoPoint.create(1 + offset, 0 + offset).getValue(),
  ]).getValue();
}

function buildFeeMatrix() {
  return DeliveryFeeMatrix.create({
    tiers: [{ maxDistanceMeters: 2000, fee: Money.create(2000).getValue() }],
  }).getValue();
}

function emptySchedule(): WeeklySchedule {
  return {
    [WEEKDAY.MONDAY]: [],
    [WEEKDAY.TUESDAY]: [],
    [WEEKDAY.WEDNESDAY]: [],
    [WEEKDAY.THURSDAY]: [],
    [WEEKDAY.FRIDAY]: [],
    [WEEKDAY.SATURDAY]: [],
    [WEEKDAY.SUNDAY]: [],
  };
}

function buildOpeningHours() {
  const schedule = emptySchedule();
  schedule[WEEKDAY.MONDAY] = [{ open: '09:00', close: '22:00' }];
  return OpeningHours.create({ schedule, holidays: [] }).getValue();
}

describe('Restaurant aggregate', () => {
  describe('create', () => {
    it('creates a restaurant in DRAFT status with HIDDEN visibility and version 0', () => {
      const result = Restaurant.create(buildInput());
      expect(result.isSuccess).toBe(true);

      const restaurant = result.getValue();
      expect(restaurant.status.value).toBe(RESTAURANT_STATUS.DRAFT);
      expect(restaurant.visibility.value).toBe(CATALOG_VISIBILITY.HIDDEN);
      expect(restaurant.version).toBe(0);
      expect(restaurant.ownerId).toBe('owner-1');
      expect(restaurant.name).toBe('Spice Garden');
      expect(restaurant.categories).toEqual([]);
      expect(restaurant.deliveryZones).toEqual([]);
      expect(restaurant.deletedAt).toBeNull();
    });

    it('derives a slug from the name when none is provided', () => {
      const restaurant = Restaurant.create(buildInput({ name: 'Spice Garden Express!' })).getValue();
      expect(restaurant.slug).toBe('spice-garden-express');
    });

    it('uses the provided slug when valid', () => {
      const restaurant = Restaurant.create(buildInput({ slug: 'custom-slug' })).getValue();
      expect(restaurant.slug).toBe('custom-slug');
    });

    it('rejects an invalid provided slug', () => {
      const result = Restaurant.create(buildInput({ slug: 'Invalid Slug!' }));
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('rejects an empty name', () => {
      const result = Restaurant.create(buildInput({ name: '   ' }));
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('rejects an empty phone number', () => {
      const result = Restaurant.create(buildInput({ phone: '' }));
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('rejects an invalid cuisine type', () => {
      const result = Restaurant.create(buildInput({ cuisineTypes: ['NOT_A_CUISINE' as any] }));
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('raises RestaurantCreated', () => {
      const restaurant = Restaurant.create(buildInput()).getValue();
      const events = restaurant.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(RestaurantCreated);
      expect(events[0].aggregateId).toBe(restaurant.id.toString());
    });
  });

  describe('updateProfile', () => {
    it('updates provided fields, bumps version, and raises RestaurantUpdated', () => {
      const restaurant = Restaurant.create(buildInput()).getValue();
      restaurant.pullDomainEvents();

      const result = restaurant.updateProfile({ name: 'Spice Garden 2.0', description: 'Now spicier' });
      expect(result.isSuccess).toBe(true);
      expect(restaurant.name).toBe('Spice Garden 2.0');
      expect(restaurant.description).toBe('Now spicier');
      expect(restaurant.version).toBe(1);

      const events = restaurant.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(RestaurantUpdated);
      expect((events[0] as RestaurantUpdated).changedFields).toEqual(
        expect.arrayContaining(['name', 'description'])
      );
    });

    it('rejects an empty name and leaves state unchanged', () => {
      const restaurant = Restaurant.create(buildInput()).getValue();
      restaurant.pullDomainEvents();

      const result = restaurant.updateProfile({ name: '   ' });
      expect(result.isFailure).toBe(true);
      expect(restaurant.name).toBe('Spice Garden');
      expect(restaurant.version).toBe(0);
      expect(restaurant.pullDomainEvents()).toHaveLength(0);
    });
  });

  describe('category management', () => {
    it('adds a category, raises CategoryAdded, and bumps version', () => {
      const restaurant = Restaurant.create(buildInput()).getValue();
      restaurant.pullDomainEvents();

      const result = restaurant.addCategory('Starters');
      expect(result.isSuccess).toBe(true);

      const category = result.getValue();
      expect(category.label).toBe('Starters');
      expect(category.sortOrder).toBe(0);
      expect(category.isActive).toBe(true);
      expect(restaurant.categories).toHaveLength(1);
      expect(restaurant.version).toBe(1);

      const events = restaurant.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(CategoryAdded);
    });

    it('rejects an empty category label', () => {
      const restaurant = Restaurant.create(buildInput()).getValue();
      const result = restaurant.addCategory('   ');
      expect(result.isFailure).toBe(true);
      expect(restaurant.categories).toHaveLength(0);
    });

    it('updates a category and raises CategoryUpdated', () => {
      const restaurant = Restaurant.create(buildInput()).getValue();
      const category = restaurant.addCategory('Starters').getValue();
      restaurant.pullDomainEvents();

      const result = restaurant.updateCategory(category.id.toString(), { label: 'Appetizers', sortOrder: 2 });
      expect(result.isSuccess).toBe(true);
      expect(category.label).toBe('Appetizers');
      expect(category.sortOrder).toBe(2);

      const events = restaurant.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(CategoryUpdated);
    });

    it('fails to update a non-existent category', () => {
      const restaurant = Restaurant.create(buildInput()).getValue();
      const result = restaurant.updateCategory('does-not-exist', { label: 'X' });
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(NotFoundError);
    });

    it('reorders categories', () => {
      const restaurant = Restaurant.create(buildInput()).getValue();
      const c1 = restaurant.addCategory('Starters').getValue();
      const c2 = restaurant.addCategory('Mains').getValue();
      restaurant.pullDomainEvents();

      const result = restaurant.reorderCategories([c2.id.toString(), c1.id.toString()]);
      expect(result.isSuccess).toBe(true);
      expect(c2.sortOrder).toBe(0);
      expect(c1.sortOrder).toBe(1);

      const events = restaurant.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(CategoryUpdated);
    });

    it('rejects reorderCategories with a mismatched id set', () => {
      const restaurant = Restaurant.create(buildInput()).getValue();
      restaurant.addCategory('Starters');

      const result = restaurant.reorderCategories(['unknown-id']);
      expect(result.isFailure).toBe(true);
    });

    it('removes a category and raises CategoryUpdated', () => {
      const restaurant = Restaurant.create(buildInput()).getValue();
      const category = restaurant.addCategory('Starters').getValue();
      restaurant.pullDomainEvents();

      const result = restaurant.removeCategory(category.id.toString());
      expect(result.isSuccess).toBe(true);
      expect(restaurant.categories).toHaveLength(0);

      const events = restaurant.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(CategoryUpdated);
    });

    it('fails to remove a non-existent category', () => {
      const restaurant = Restaurant.create(buildInput()).getValue();
      const result = restaurant.removeCategory('does-not-exist');
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(NotFoundError);
    });

    it('prevents deactivating the last active category while the restaurant is ACTIVE', () => {
      const restaurant = Restaurant.create(buildInput()).getValue();
      const category = restaurant.addCategory('Starters').getValue();
      expect(restaurant.publish().isSuccess).toBe(true);

      const result = restaurant.updateCategory(category.id.toString(), { isActive: false });
      expect(result.isFailure).toBe(true);
      expect(category.isActive).toBe(true);
    });

    it('prevents removing the last active category while the restaurant is ACTIVE', () => {
      const restaurant = Restaurant.create(buildInput()).getValue();
      const category = restaurant.addCategory('Starters').getValue();
      expect(restaurant.publish().isSuccess).toBe(true);

      const result = restaurant.removeCategory(category.id.toString());
      expect(result.isFailure).toBe(true);
      expect(restaurant.categories).toHaveLength(1);
    });
  });

  describe('publish / pause / close', () => {
    it('rejects publish() when there is no active category', () => {
      const restaurant = Restaurant.create(buildInput()).getValue();
      restaurant.pullDomainEvents();

      const result = restaurant.publish();
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
      expect(restaurant.status.value).toBe(RESTAURANT_STATUS.DRAFT);
      expect(restaurant.pullDomainEvents()).toHaveLength(0);
    });

    it('publishes a restaurant with an active category, raising RestaurantStatusChanged', () => {
      const restaurant = Restaurant.create(buildInput()).getValue();
      restaurant.addCategory('Starters');
      restaurant.pullDomainEvents();

      const result = restaurant.publish();
      expect(result.isSuccess).toBe(true);
      expect(restaurant.status.value).toBe(RESTAURANT_STATUS.ACTIVE);

      const events = restaurant.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(RestaurantStatusChanged);
      const evt = events[0] as RestaurantStatusChanged;
      expect(evt.previousStatus).toBe(RESTAURANT_STATUS.DRAFT);
      expect(evt.newStatus).toBe(RESTAURANT_STATUS.ACTIVE);
    });

    it('pauses an ACTIVE restaurant', () => {
      const restaurant = Restaurant.create(buildInput()).getValue();
      restaurant.addCategory('Starters');
      restaurant.publish();
      restaurant.pullDomainEvents();

      const result = restaurant.pause();
      expect(result.isSuccess).toBe(true);
      expect(restaurant.status.value).toBe(RESTAURANT_STATUS.PAUSED);
      expect(restaurant.pullDomainEvents()[0]).toBeInstanceOf(RestaurantStatusChanged);
    });

    it('rejects pause() from DRAFT', () => {
      const restaurant = Restaurant.create(buildInput()).getValue();
      const result = restaurant.pause();
      expect(result.isFailure).toBe(true);
      expect(restaurant.status.value).toBe(RESTAURANT_STATUS.DRAFT);
    });

    it('re-publishes a PAUSED restaurant back to ACTIVE', () => {
      const restaurant = Restaurant.create(buildInput()).getValue();
      restaurant.addCategory('Starters');
      restaurant.publish();
      restaurant.pause();
      restaurant.pullDomainEvents();

      const result = restaurant.publish();
      expect(result.isSuccess).toBe(true);
      expect(restaurant.status.value).toBe(RESTAURANT_STATUS.ACTIVE);
    });

    it('closes an ACTIVE restaurant permanently', () => {
      const restaurant = Restaurant.create(buildInput()).getValue();
      restaurant.addCategory('Starters');
      restaurant.publish();
      restaurant.pullDomainEvents();

      const result = restaurant.close();
      expect(result.isSuccess).toBe(true);
      expect(restaurant.status.value).toBe(RESTAURANT_STATUS.CLOSED);

      const reopenAttempt = restaurant.publish();
      expect(reopenAttempt.isFailure).toBe(true);
      expect(restaurant.status.value).toBe(RESTAURANT_STATUS.CLOSED);
    });

    it('rejects close() from DRAFT', () => {
      const restaurant = Restaurant.create(buildInput()).getValue();
      const result = restaurant.close();
      expect(result.isFailure).toBe(true);
      expect(restaurant.status.value).toBe(RESTAURANT_STATUS.DRAFT);
    });
  });

  describe('visibility', () => {
    it('sets visibility and raises RestaurantUpdated', () => {
      const restaurant = Restaurant.create(buildInput()).getValue();
      restaurant.pullDomainEvents();

      const visibility = CatalogVisibility.create(CATALOG_VISIBILITY.PUBLIC).getValue();
      const result = restaurant.setVisibility(visibility);
      expect(result.isSuccess).toBe(true);
      expect(restaurant.visibility.value).toBe(CATALOG_VISIBILITY.PUBLIC);
      expect(restaurant.version).toBe(1);
      expect(restaurant.pullDomainEvents()[0]).toBeInstanceOf(RestaurantUpdated);
    });
  });

  describe('opening hours', () => {
    it('sets opening hours and raises RestaurantUpdated', () => {
      const restaurant = Restaurant.create(buildInput()).getValue();
      restaurant.pullDomainEvents();

      const hours = buildOpeningHours();
      const result = restaurant.setOpeningHours(hours);
      expect(result.isSuccess).toBe(true);
      expect(restaurant.openingHours).toBe(hours);
      expect(restaurant.pullDomainEvents()[0]).toBeInstanceOf(RestaurantUpdated);
    });
  });

  describe('delivery zone management', () => {
    it('adds a delivery zone and raises DeliveryZoneChanged', () => {
      const restaurant = Restaurant.create(buildInput()).getValue();
      restaurant.pullDomainEvents();

      const result = restaurant.addZone({
        polygon: buildPolygon(),
        feeMatrix: buildFeeMatrix(),
        minOrder: Money.create(10000).getValue(),
      });
      expect(result.isSuccess).toBe(true);
      expect(restaurant.deliveryZones).toHaveLength(1);

      const events = restaurant.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(DeliveryZoneChanged);
    });

    it('updates a delivery zone', () => {
      const restaurant = Restaurant.create(buildInput()).getValue();
      const zone = restaurant.addZone({
        polygon: buildPolygon(),
        feeMatrix: buildFeeMatrix(),
        minOrder: Money.create(10000).getValue(),
      }).getValue();
      restaurant.pullDomainEvents();

      const newMin = Money.create(15000).getValue();
      const result = restaurant.updateZone(zone.id.toString(), { minOrder: newMin });
      expect(result.isSuccess).toBe(true);
      expect(zone.minOrder).toBe(newMin);
      expect(restaurant.pullDomainEvents()[0]).toBeInstanceOf(DeliveryZoneChanged);
    });

    it('fails to update a non-existent delivery zone', () => {
      const restaurant = Restaurant.create(buildInput()).getValue();
      const result = restaurant.updateZone('does-not-exist', { minOrder: Money.create(1000).getValue() });
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(NotFoundError);
    });

    it('removes a delivery zone', () => {
      const restaurant = Restaurant.create(buildInput()).getValue();
      const zone = restaurant.addZone({
        polygon: buildPolygon(),
        feeMatrix: buildFeeMatrix(),
        minOrder: Money.create(10000).getValue(),
      }).getValue();
      restaurant.pullDomainEvents();

      const result = restaurant.removeZone(zone.id.toString());
      expect(result.isSuccess).toBe(true);
      expect(restaurant.deliveryZones).toHaveLength(0);
      expect(restaurant.pullDomainEvents()[0]).toBeInstanceOf(DeliveryZoneChanged);
    });

    it('fails to remove a non-existent delivery zone', () => {
      const restaurant = Restaurant.create(buildInput()).getValue();
      const result = restaurant.removeZone('does-not-exist');
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(NotFoundError);
    });
  });

  describe('soft delete', () => {
    it('soft-deletes a restaurant', () => {
      const restaurant = Restaurant.create(buildInput()).getValue();
      const result = restaurant.softDelete();
      expect(result.isSuccess).toBe(true);
      expect(restaurant.deletedAt).toBeInstanceOf(Date);
    });

    it('fails to soft-delete an already-deleted restaurant', () => {
      const restaurant = Restaurant.create(buildInput()).getValue();
      restaurant.softDelete();

      const result = restaurant.softDelete();
      expect(result.isFailure).toBe(true);
    });
  });
});
