// Registers CommerceCatalogProjector subscriptions for the catalog events routed to
// QUEUE.commerce (Commerce Phase 5). Mirrors registerCatalogProjector: subscribes on
// the shared in-process event bus, which is what the OutboxProcessor publishes
// drained outbox rows onto.
import { IEventBus } from '../../shared/events/IEventBus';
import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { CommerceCatalogProjector } from './CommerceCatalogProjector';

export function registerCommerceCatalogProjector(eventBus: IEventBus, projector: CommerceCatalogProjector): void {
  // Restaurant-aggregate events: aggregateId IS the restaurantId.
  for (const eventName of ['RestaurantUpdated', 'RestaurantStatusChanged']) {
    eventBus.subscribe(eventName, (event) => projector.onRestaurantEvent(event));
  }

  // MenuItemAvailabilityChanged carries restaurantId directly.
  eventBus.subscribe('MenuItemAvailabilityChanged', (event) =>
    projector.onMenuItemEvent(event as DomainEvent & { restaurantId: string })
  );

  // MenuItemUpdated carries only the item id.
  eventBus.subscribe('MenuItemUpdated', (event) => projector.onMenuItemUpdated(event));
}
