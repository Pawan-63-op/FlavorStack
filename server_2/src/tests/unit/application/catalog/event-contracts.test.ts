import {
  CATALOG_EVENT_SCHEMAS,
  CATALOG_EVENT_NAMES,
  isCatalogEvent,
  assertCatalogEventContract,
} from '../../../../application/catalog/contracts/CatalogEventContracts';
import { DomainEvent } from '../../../../domain/shared/DomainEvent';

import { RestaurantCreated } from '../../../../domain/catalog/events/RestaurantCreated';
import { RestaurantUpdated } from '../../../../domain/catalog/events/RestaurantUpdated';
import { RestaurantStatusChanged } from '../../../../domain/catalog/events/RestaurantStatusChanged';
import { CategoryAdded } from '../../../../domain/catalog/events/CategoryAdded';
import { CategoryUpdated } from '../../../../domain/catalog/events/CategoryUpdated';
import { DeliveryZoneChanged } from '../../../../domain/catalog/events/DeliveryZoneChanged';
import { MenuItemCreated } from '../../../../domain/catalog/events/MenuItemCreated';
import { MenuItemUpdated } from '../../../../domain/catalog/events/MenuItemUpdated';
import { MenuItemAvailabilityChanged } from '../../../../domain/catalog/events/MenuItemAvailabilityChanged';
import { RESTAURANT_STATUS } from '../../../../domain/catalog/enums/restaurant-status.enum';

/** Serialize an event exactly as MongoOutboxStore.toOutboxRow does. */
function serialized(event: DomainEvent): Record<string, unknown> {
  return JSON.parse(JSON.stringify(event)) as Record<string, unknown>;
}

const samples: Record<string, DomainEvent> = {
  RestaurantCreated: new RestaurantCreated('rest-1', 'owner-1', 'Spice Garden', 'spice-garden'),
  RestaurantUpdated: new RestaurantUpdated('rest-1', ['name', 'description']),
  RestaurantStatusChanged: new RestaurantStatusChanged(
    'rest-1',
    RESTAURANT_STATUS.DRAFT,
    RESTAURANT_STATUS.ACTIVE
  ),
  CategoryAdded: new CategoryAdded('rest-1', 'cat-1', 'Starters'),
  CategoryUpdated: new CategoryUpdated('rest-1', 'cat-1', 'UPDATED'),
  DeliveryZoneChanged: new DeliveryZoneChanged('rest-1', 'zone-1', 'ADDED'),
  MenuItemCreated: new MenuItemCreated('item-1', 'rest-1', 'cat-1', 'Paneer Tikka'),
  MenuItemUpdated: new MenuItemUpdated('item-1', ['basePrice']),
  MenuItemAvailabilityChanged: new MenuItemAvailabilityChanged('item-1', 'rest-1', false, 'sold out'),
};

describe('Catalog event payload contracts', () => {
  it('exposes a schema for every published catalog event and vice-versa', () => {
    expect(Object.keys(samples).sort()).toEqual([...CATALOG_EVENT_NAMES].sort());
  });

  it.each(CATALOG_EVENT_NAMES)('%s serialized payload satisfies its contract', (name) => {
    const event = samples[name];
    expect(event).toBeDefined();
    const payload = serialized(event);

    expect(payload.eventName).toBe(name);
    expect(typeof payload.occurredOn).toBe('string');

    expect(() => assertCatalogEventContract(name, payload)).not.toThrow();
    expect(CATALOG_EVENT_SCHEMAS[name].safeParse(payload).success).toBe(true);
  });

  it('accepts MenuItemAvailabilityChanged without an optional outOfStockReason', () => {
    const event = new MenuItemAvailabilityChanged('item-1', 'rest-1', true);
    const payload = serialized(event);
    expect(payload).not.toHaveProperty('outOfStockReason');
    expect(CATALOG_EVENT_SCHEMAS.MenuItemAvailabilityChanged.safeParse(payload).success).toBe(true);
  });

  it('accepts CategoryUpdated with a null categoryId (e.g. REORDERED)', () => {
    const event = new CategoryUpdated('rest-1', null, 'REORDERED');
    expect(CATALOG_EVENT_SCHEMAS.CategoryUpdated.safeParse(serialized(event)).success).toBe(true);
  });

  describe('rejects contract violations', () => {
    it('rejects a payload missing a required field', () => {
      const { name: _omit, ...withoutName } = serialized(samples.RestaurantCreated);
      expect(CATALOG_EVENT_SCHEMAS.RestaurantCreated.safeParse(withoutName).success).toBe(false);
    });

    it('rejects an out-of-domain restaurant status', () => {
      const payload = { ...serialized(samples.RestaurantStatusChanged), newStatus: 'BANANA' };
      expect(CATALOG_EVENT_SCHEMAS.RestaurantStatusChanged.safeParse(payload).success).toBe(false);
    });

    it('rejects a wrong-typed field (changedFields not an array)', () => {
      const payload = { ...serialized(samples.MenuItemUpdated), changedFields: 'basePrice' };
      expect(CATALOG_EVENT_SCHEMAS.MenuItemUpdated.safeParse(payload).success).toBe(false);
    });

    it('rejects a non-uuid eventId', () => {
      const payload = { ...serialized(samples.CategoryAdded), eventId: 'not-a-uuid' };
      expect(CATALOG_EVENT_SCHEMAS.CategoryAdded.safeParse(payload).success).toBe(false);
    });
  });

  describe('isCatalogEvent', () => {
    it('recognizes catalog events and rejects foreign ones', () => {
      expect(isCatalogEvent('MenuItemCreated')).toBe(true);
      expect(isCatalogEvent('UserRegistered')).toBe(false);
    });
  });
});
