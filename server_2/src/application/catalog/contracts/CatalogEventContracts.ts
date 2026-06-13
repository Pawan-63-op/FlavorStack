// Catalog Phase 12 — cross-context event payload contracts.
//
// These Zod schemas describe the *serialized* shape of every catalog domain event
// as it lands in the shared `outbox` collection (i.e. `JSON.parse(JSON.stringify(event))`)
// and is therefore the exact shape downstream contexts (Commerce, Fulfillment,
// Search re-indexer, Notification) consume off BullMQ. They are the published
// contract — guarded by contract tests so the cross-context boundary can't drift
// as services split later.
//
// Domain stays framework-free (CLAUDE.md): the event classes live under
// `src/domain/catalog/events/` with no validation deps; these schemas live in the
// application layer where Zod is already an allowed dependency.
import { z } from 'zod';
import { RESTAURANT_STATUS } from '../../../domain/catalog/enums/restaurant-status.enum';

/** Canonical envelope every DomainEvent carries once serialized for the outbox. */
const eventEnvelope = z.object({
  eventId: z.string().uuid(),
  eventName: z.string().min(1),
  aggregateId: z.string().min(1),
  // `occurredOn` is a Date in-process; JSON serialization (the outbox payload)
  // turns it into an ISO-8601 string.
  occurredOn: z.string().datetime(),
});

const restaurantStatusValue = z.enum([
  RESTAURANT_STATUS.DRAFT,
  RESTAURANT_STATUS.ACTIVE,
  RESTAURANT_STATUS.PAUSED,
  RESTAURANT_STATUS.CLOSED,
]);

const categoryChangeAction = z.enum(['UPDATED', 'REORDERED', 'REMOVED']);
const deliveryZoneChangeAction = z.enum(['ADDED', 'UPDATED', 'REMOVED']);

// ── Restaurant-aggregate events (aggregateId === restaurantId) ───────────────

export const RestaurantCreatedSchema = eventEnvelope.extend({
  eventName: z.literal('RestaurantCreated'),
  ownerId: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
});

export const RestaurantUpdatedSchema = eventEnvelope.extend({
  eventName: z.literal('RestaurantUpdated'),
  changedFields: z.array(z.string()),
});

export const RestaurantStatusChangedSchema = eventEnvelope.extend({
  eventName: z.literal('RestaurantStatusChanged'),
  previousStatus: restaurantStatusValue,
  newStatus: restaurantStatusValue,
});

export const CategoryAddedSchema = eventEnvelope.extend({
  eventName: z.literal('CategoryAdded'),
  categoryId: z.string().min(1),
  label: z.string().min(1),
});

export const CategoryUpdatedSchema = eventEnvelope.extend({
  eventName: z.literal('CategoryUpdated'),
  categoryId: z.string().min(1).nullable(),
  action: categoryChangeAction,
});

export const DeliveryZoneChangedSchema = eventEnvelope.extend({
  eventName: z.literal('DeliveryZoneChanged'),
  zoneId: z.string().min(1),
  action: deliveryZoneChangeAction,
});

// ── MenuItem-aggregate events (aggregateId === menuItemId) ───────────────────

export const MenuItemCreatedSchema = eventEnvelope.extend({
  eventName: z.literal('MenuItemCreated'),
  restaurantId: z.string().min(1),
  categoryId: z.string().min(1),
  name: z.string().min(1),
});

export const MenuItemUpdatedSchema = eventEnvelope.extend({
  eventName: z.literal('MenuItemUpdated'),
  changedFields: z.array(z.string()),
});

export const MenuItemAvailabilityChangedSchema = eventEnvelope.extend({
  eventName: z.literal('MenuItemAvailabilityChanged'),
  restaurantId: z.string().min(1),
  isAvailable: z.boolean(),
  // `undefined` is dropped by JSON serialization, so the field is simply absent
  // when there's no reason — hence `.optional()`, not `.nullable()`.
  outOfStockReason: z.string().optional(),
});

/**
 * Registry of every published catalog event → its payload schema. The single
 * source of truth the contract tests iterate over and downstream consumers can
 * import to validate inbound jobs.
 */
export const CATALOG_EVENT_SCHEMAS = {
  RestaurantCreated: RestaurantCreatedSchema,
  RestaurantUpdated: RestaurantUpdatedSchema,
  RestaurantStatusChanged: RestaurantStatusChangedSchema,
  CategoryAdded: CategoryAddedSchema,
  CategoryUpdated: CategoryUpdatedSchema,
  DeliveryZoneChanged: DeliveryZoneChangedSchema,
  MenuItemCreated: MenuItemCreatedSchema,
  MenuItemUpdated: MenuItemUpdatedSchema,
  MenuItemAvailabilityChanged: MenuItemAvailabilityChangedSchema,
} as const;

export type CatalogEventName = keyof typeof CATALOG_EVENT_SCHEMAS;

/** Names of all events catalog publishes — handy for routing/registry wiring. */
export const CATALOG_EVENT_NAMES = Object.keys(CATALOG_EVENT_SCHEMAS) as CatalogEventName[];

/** True when `eventName` is a catalog-published event we hold a contract for. */
export function isCatalogEvent(eventName: string): eventName is CatalogEventName {
  return Object.prototype.hasOwnProperty.call(CATALOG_EVENT_SCHEMAS, eventName);
}

/**
 * Validate an (already-serialized) event payload against its contract.
 * Throws ZodError on mismatch — used by contract tests and may be used by
 * consumers as an inbound guard.
 */
export function assertCatalogEventContract(eventName: CatalogEventName, payload: unknown): void {
  CATALOG_EVENT_SCHEMAS[eventName].parse(payload);
}
