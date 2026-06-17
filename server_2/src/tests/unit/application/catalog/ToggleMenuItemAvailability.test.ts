import { ToggleMenuItemAvailability } from '../../../../application/catalog/use-cases/ToggleMenuItemAvailability';
import { InMemoryRestaurantRepository, InMemoryMenuItemRepository } from '../../../mocks/catalog.mocks';
import { InMemoryUnitOfWork, InMemoryOutboxStore } from '../../../mocks/identity.mocks';
import { createEventBusSpy, EventBusSpy } from '../../../mocks/shared.mocks';
import { buildRestaurant, buildMenuItem } from './helpers';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';

describe('ToggleMenuItemAvailability use-case', () => {
  let restaurantRepo: InMemoryRestaurantRepository;
  let menuItemRepo: InMemoryMenuItemRepository;
  let unitOfWork: InMemoryUnitOfWork;
  let outboxStore: InMemoryOutboxStore;
  let eventBus: EventBusSpy;
  let useCase: ToggleMenuItemAvailability;

  beforeEach(() => {
    restaurantRepo = new InMemoryRestaurantRepository();
    menuItemRepo = new InMemoryMenuItemRepository();
    unitOfWork = new InMemoryUnitOfWork();
    outboxStore = new InMemoryOutboxStore();
    eventBus = createEventBusSpy();
    useCase = new ToggleMenuItemAvailability(restaurantRepo, menuItemRepo, unitOfWork, outboxStore, eventBus);
  });

  async function seed() {
    const restaurant = buildRestaurant();
    const categoryId = restaurant.categories[0].id.toString();
    const menuItem = buildMenuItem(restaurant.id.toString(), categoryId);
    await restaurantRepo.save(restaurant);
    await menuItemRepo.save(menuItem);
    return { restaurant, menuItem };
  }

  it('marks the item unavailable with a reason', async () => {
    const { menuItem } = await seed();

    const result = await useCase.execute({
      itemId: menuItem.id.toString(),
      actorId: 'owner-1',
      isAvailable: false,
      outOfStockReason: 'Out of paneer',
    });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().availability.isAvailable).toBe(false);
    expect(result.getValue().availability.outOfStockReason).toBe('Out of paneer');

    expect(outboxStore.appended).toHaveLength(1);
    expect(outboxStore.appended[0].eventName).toBe('MenuItemAvailabilityChanged');
    expect(eventBus.publishedEvents).toHaveLength(1);
  });

  it('fails with NotFoundError when menu item does not exist', async () => {
    const result = await useCase.execute({ itemId: 'missing', actorId: 'owner-1', isAvailable: false });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
  });

  it('fails with ForbiddenError when actor is not the owner', async () => {
    const { menuItem } = await seed();

    const result = await useCase.execute({
      itemId: menuItem.id.toString(),
      actorId: 'someone-else',
      isAvailable: false,
    });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ForbiddenError);
  });

  it('fails with ValidationError when outOfStockReason is set while available', async () => {
    const { menuItem } = await seed();

    const result = await useCase.execute({
      itemId: menuItem.id.toString(),
      actorId: 'owner-1',
      isAvailable: true,
      outOfStockReason: 'Should not be allowed',
    });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
    expect(outboxStore.appended).toHaveLength(0);
    expect(eventBus.publishedEvents).toHaveLength(0);
  });
});
