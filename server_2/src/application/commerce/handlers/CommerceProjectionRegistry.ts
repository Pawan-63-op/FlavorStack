import { IEventBus } from '../../shared/events/IEventBus';
import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { CommerceCatalogProjector } from './CommerceCatalogProjector';

export function registerCommerceCatalogProjector(eventBus: IEventBus, projector: CommerceCatalogProjector): void {
  for (const eventName of ['RestaurantUpdated', 'RestaurantStatusChanged']) {
    eventBus.subscribe(eventName, (event) => projector.onRestaurantEvent(event));
  }

  eventBus.subscribe('MenuItemAvailabilityChanged', (event) =>
    projector.onMenuItemEvent(event as DomainEvent & { restaurantId: string })
  );

  eventBus.subscribe('MenuItemUpdated', (event) => projector.onMenuItemUpdated(event));
}
