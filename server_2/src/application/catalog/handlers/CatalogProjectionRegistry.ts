// Subscribes the CatalogProjector to catalog domain events on the in-process bus
// (Catalog Phase 9). Must run at startup before the outbox processor drains, so
// projections stay in sync with every committed write.
import { IEventBus } from '../../shared/events/IEventBus';
import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { CatalogProjector } from './CatalogProjector';

export function registerCatalogProjector(eventBus: IEventBus, projector: CatalogProjector): void {
  // Restaurant-aggregate events: aggregateId IS the restaurantId.
  for (const eventName of [
    'RestaurantCreated',
    'RestaurantUpdated',
    'RestaurantStatusChanged',
    'CategoryAdded',
    'CategoryUpdated',
    'DeliveryZoneChanged',
  ]) {
    eventBus.subscribe(eventName, (event) => projector.onRestaurantEvent(event));
  }

  // Item events that carry restaurantId directly.
  for (const eventName of ['MenuItemCreated', 'MenuItemAvailabilityChanged']) {
    eventBus.subscribe(eventName, (event) =>
      projector.onMenuItemEvent(event as DomainEvent & { restaurantId: string })
    );
  }

  // MenuItemUpdated carries only the item id.
  eventBus.subscribe('MenuItemUpdated', (event) => projector.onMenuItemUpdated(event));
}
