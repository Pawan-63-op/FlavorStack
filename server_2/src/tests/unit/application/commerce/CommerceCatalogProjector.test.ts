import { CommerceCatalogProjector } from '../../../../application/commerce/handlers/CommerceCatalogProjector';
import { IRestaurantRepository } from '../../../../domain/catalog/repositories/IRestaurantRepository';
import { IMenuItemRepository } from '../../../../domain/catalog/repositories/IMenuItemRepository';
import { ICommerceCatalogReadRepository } from '../../../../domain/commerce/repositories/ICommerceCatalogReadRepository';
import { CommerceCatalogRestaurantView } from '../../../../domain/commerce/types/CommerceCatalogView';
import { Restaurant } from '../../../../domain/catalog/entities/Restaurant';
import { MenuItem } from '../../../../domain/catalog/entities/MenuItem';
import { RestaurantUpdated } from '../../../../domain/catalog/events/RestaurantUpdated';
import { RestaurantStatusChanged } from '../../../../domain/catalog/events/RestaurantStatusChanged';
import { MenuItemUpdated } from '../../../../domain/catalog/events/MenuItemUpdated';
import { MenuItemAvailabilityChanged } from '../../../../domain/catalog/events/MenuItemAvailabilityChanged';
import { RESTAURANT_STATUS } from '../../../../domain/catalog/enums/restaurant-status.enum';
import { buildRestaurant, buildMenuItem } from '../../../integration/catalog/catalog-fixtures';

function makeRestaurantRepo(restaurant: Restaurant | null): IRestaurantRepository {
  return {
    save: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    findById: jest.fn().mockResolvedValue(restaurant),
    findBySlug: jest.fn(),
    findByOwner: jest.fn(),
    findAll: jest.fn(),
  } as unknown as IRestaurantRepository;
}

function makeMenuItemRepo(opts: { items?: MenuItem[]; findByIdResult?: MenuItem | null } = {}): IMenuItemRepository {
  const items = opts.items ?? [];
  return {
    save: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    findById: jest.fn().mockResolvedValue(opts.findByIdResult ?? null),
    findByRestaurant: jest.fn().mockResolvedValue({ items, nextCursor: undefined }),
    findByCategory: jest.fn(),
  } as unknown as IMenuItemRepository;
}

function makeProjectionRepo(markEventProcessedResult = true): ICommerceCatalogReadRepository {
  return {
    findRestaurantView: jest.fn(),
    findMenuItemViews: jest.fn(),
    upsertRestaurantView: jest.fn().mockResolvedValue(undefined),
    removeRestaurantView: jest.fn().mockResolvedValue(undefined),
    markEventProcessed: jest.fn().mockResolvedValue(markEventProcessedResult),
  } as unknown as ICommerceCatalogReadRepository;
}

describe('CommerceCatalogProjector', () => {
  const restaurantId = 'rest-1';

  describe('onRestaurantEvent', () => {
    it('rebuilds the projection from the restaurant + its items', async () => {
      const restaurant = buildRestaurant({ withZone: true, withOpeningHours: true });
      const id = restaurant.id.toString();
      const item = buildMenuItem({ restaurantId: id, withVariants: true });

      const restaurantRepo = makeRestaurantRepo(restaurant);
      const menuItemRepo = makeMenuItemRepo({ items: [item] });
      const projectionRepo = makeProjectionRepo();

      const projector = new CommerceCatalogProjector(restaurantRepo, menuItemRepo, projectionRepo);
      const event = new RestaurantUpdated(id, ['name']);

      await projector.onRestaurantEvent(event);

      expect(projectionRepo.markEventProcessed).toHaveBeenCalledWith(event.eventId, event.eventName, id);
      expect(restaurantRepo.findById).toHaveBeenCalledWith(id);
      expect(projectionRepo.upsertRestaurantView).toHaveBeenCalledTimes(1);

      const view = (projectionRepo.upsertRestaurantView as jest.Mock).mock.calls[0][0] as CommerceCatalogRestaurantView;
      expect(view.restaurantId).toBe(id);
      expect(view.name).toBe(restaurant.name);
      expect(view.status).toBe(restaurant.status.value);
      expect(view.visibility).toBe(restaurant.visibility.value);
      expect(view.openingHours).not.toBeNull();
      expect(view.deliveryZones).toHaveLength(1);
      expect(view.items).toHaveLength(1);

      const itemView = view.items[0];
      expect(itemView.menuItemId).toBe(item.id.toString());
      expect(itemView.basePriceAmount).toBe(item.basePrice.amount);
      expect(itemView.isAvailable).toBe(item.availability.isAvailable);
      expect(itemView.variantGroups).toHaveLength(1);
      expect(itemView.variantGroups[0].options).toHaveLength(2);
    });

    it('applies RestaurantStatusChanged by rebuilding the projection', async () => {
      const restaurant = buildRestaurant();
      const id = restaurant.id.toString();

      const restaurantRepo = makeRestaurantRepo(restaurant);
      const menuItemRepo = makeMenuItemRepo();
      const projectionRepo = makeProjectionRepo();

      const projector = new CommerceCatalogProjector(restaurantRepo, menuItemRepo, projectionRepo);
      const event = new RestaurantStatusChanged(id, RESTAURANT_STATUS.DRAFT, RESTAURANT_STATUS.ACTIVE);

      await projector.onRestaurantEvent(event);

      expect(projectionRepo.upsertRestaurantView).toHaveBeenCalledTimes(1);
      const view = (projectionRepo.upsertRestaurantView as jest.Mock).mock.calls[0][0] as CommerceCatalogRestaurantView;
      expect(view.status).toBe(restaurant.status.value);
    });

    it('tombstones the projection when the restaurant no longer exists', async () => {
      const restaurantRepo = makeRestaurantRepo(null);
      const menuItemRepo = makeMenuItemRepo();
      const projectionRepo = makeProjectionRepo();

      const projector = new CommerceCatalogProjector(restaurantRepo, menuItemRepo, projectionRepo);
      const event = new RestaurantUpdated(restaurantId, ['deletedAt']);

      await projector.onRestaurantEvent(event);

      expect(projectionRepo.removeRestaurantView).toHaveBeenCalledWith(restaurantId);
      expect(projectionRepo.upsertRestaurantView).not.toHaveBeenCalled();
    });

    it('is idempotent: a redelivered eventId is a no-op', async () => {
      const restaurantRepo = makeRestaurantRepo(buildRestaurant());
      const menuItemRepo = makeMenuItemRepo();
      const projectionRepo = makeProjectionRepo(false); // already processed

      const projector = new CommerceCatalogProjector(restaurantRepo, menuItemRepo, projectionRepo);
      const event = new RestaurantUpdated(restaurantId, ['name']);

      await projector.onRestaurantEvent(event);

      expect(projectionRepo.markEventProcessed).toHaveBeenCalledWith(event.eventId, event.eventName, restaurantId);
      expect(restaurantRepo.findById).not.toHaveBeenCalled();
      expect(projectionRepo.upsertRestaurantView).not.toHaveBeenCalled();
      expect(projectionRepo.removeRestaurantView).not.toHaveBeenCalled();
    });
  });

  describe('onMenuItemEvent', () => {
    it('rebuilds the owning restaurant projection for MenuItemAvailabilityChanged', async () => {
      const restaurant = buildRestaurant();
      const id = restaurant.id.toString();
      const item = buildMenuItem({ restaurantId: id });

      const restaurantRepo = makeRestaurantRepo(restaurant);
      const menuItemRepo = makeMenuItemRepo({ items: [item] });
      const projectionRepo = makeProjectionRepo();

      const projector = new CommerceCatalogProjector(restaurantRepo, menuItemRepo, projectionRepo);
      const event = new MenuItemAvailabilityChanged(item.id.toString(), id, false, 'sold out');

      await projector.onMenuItemEvent(event);

      expect(projectionRepo.markEventProcessed).toHaveBeenCalledWith(event.eventId, event.eventName, id);
      expect(restaurantRepo.findById).toHaveBeenCalledWith(id);
      const view = (projectionRepo.upsertRestaurantView as jest.Mock).mock.calls[0][0] as CommerceCatalogRestaurantView;
      expect(view.items[0].isAvailable).toBe(item.availability.isAvailable);
    });
  });

  describe('onMenuItemUpdated', () => {
    it('resolves the owning restaurant via the menu item and rebuilds', async () => {
      const restaurant = buildRestaurant();
      const id = restaurant.id.toString();
      const item = buildMenuItem({ restaurantId: id });

      const restaurantRepo = makeRestaurantRepo(restaurant);
      const menuItemRepo = makeMenuItemRepo({ items: [item], findByIdResult: item });
      const projectionRepo = makeProjectionRepo();

      const projector = new CommerceCatalogProjector(restaurantRepo, menuItemRepo, projectionRepo);
      const event = new MenuItemUpdated(item.id.toString(), ['basePrice']);

      await projector.onMenuItemUpdated(event);

      expect(menuItemRepo.findById).toHaveBeenCalledWith(item.id.toString());
      expect(projectionRepo.markEventProcessed).toHaveBeenCalledWith(event.eventId, event.eventName, id);
      expect(projectionRepo.upsertRestaurantView).toHaveBeenCalledTimes(1);
    });

    it('does nothing when the menu item is unknown (a later event will reconcile)', async () => {
      const restaurantRepo = makeRestaurantRepo(buildRestaurant());
      const menuItemRepo = makeMenuItemRepo({ findByIdResult: null });
      const projectionRepo = makeProjectionRepo();

      const projector = new CommerceCatalogProjector(restaurantRepo, menuItemRepo, projectionRepo);
      const event = new MenuItemUpdated('missing-item', ['basePrice']);

      await projector.onMenuItemUpdated(event);

      expect(projectionRepo.markEventProcessed).not.toHaveBeenCalled();
      expect(projectionRepo.upsertRestaurantView).not.toHaveBeenCalled();
    });
  });

  describe('rebuild pagination', () => {
    it('walks all pages of menu items', async () => {
      const restaurant = buildRestaurant();
      const id = restaurant.id.toString();
      const item1 = buildMenuItem({ restaurantId: id, name: 'Item 1' });
      const item2 = buildMenuItem({ restaurantId: id, name: 'Item 2' });

      const restaurantRepo = makeRestaurantRepo(restaurant);
      const menuItemRepo: IMenuItemRepository = {
        save: jest.fn(),
        update: jest.fn(),
        softDelete: jest.fn(),
        findById: jest.fn(),
        findByRestaurant: jest
          .fn()
          .mockResolvedValueOnce({ items: [item1], nextCursor: 'cursor-1' })
          .mockResolvedValueOnce({ items: [item2], nextCursor: undefined }),
        findByCategory: jest.fn(),
      } as unknown as IMenuItemRepository;
      const projectionRepo = makeProjectionRepo();

      const projector = new CommerceCatalogProjector(restaurantRepo, menuItemRepo, projectionRepo);
      const event = new RestaurantUpdated(id, ['name']);

      await projector.onRestaurantEvent(event);

      expect(menuItemRepo.findByRestaurant).toHaveBeenCalledTimes(2);
      const view = (projectionRepo.upsertRestaurantView as jest.Mock).mock.calls[0][0] as CommerceCatalogRestaurantView;
      expect(view.items.map((i) => i.name)).toEqual(['Item 1', 'Item 2']);
    });
  });
});
