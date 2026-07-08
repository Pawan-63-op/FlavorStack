import { IEventBus } from '../../shared/events/IEventBus';
import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { CatalogProjector } from './CatalogProjector';

export function registerCatalogProjector(eventBus: IEventBus, projector: CatalogProjector): void {
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

  for (const eventName of ['MenuItemCreated', 'MenuItemAvailabilityChanged']) {
    eventBus.subscribe(eventName, (event) =>
      projector.onMenuItemEvent(event as DomainEvent & { restaurantId: string })
    );
  }

  eventBus.subscribe('MenuItemUpdated', (event) => projector.onMenuItemUpdated(event));
}
