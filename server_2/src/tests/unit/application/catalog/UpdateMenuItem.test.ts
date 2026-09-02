import { UpdateMenuItem } from '../../../../application/catalog/use-cases/UpdateMenuItem';
import { InMemoryRestaurantRepository, InMemoryMenuItemRepository } from '../../../mocks/catalog.mocks';
import { InMemoryUnitOfWork } from '../../../mocks/identity.mocks';
import { createEventBusSpy, EventBusSpy } from '../../../mocks/shared.mocks';
import { buildRestaurant, buildMenuItem } from './helpers';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';

describe('UpdateMenuItem use-case', () => {
  let restaurantRepo: InMemoryRestaurantRepository;
  let menuItemRepo: InMemoryMenuItemRepository;
  let unitOfWork: InMemoryUnitOfWork;
  let eventBus: EventBusSpy;
  let useCase: UpdateMenuItem;

  beforeEach(() => {
    restaurantRepo = new InMemoryRestaurantRepository();
    menuItemRepo = new InMemoryMenuItemRepository();
    unitOfWork = new InMemoryUnitOfWork();
    eventBus = createEventBusSpy();
    useCase = new UpdateMenuItem(restaurantRepo, menuItemRepo, unitOfWork, eventBus);
  });

  async function seed() {
    const restaurant = buildRestaurant();
    const categoryId = restaurant.categories[0].id.toString();
    const menuItem = buildMenuItem(restaurant.id.toString(), categoryId);
    await restaurantRepo.save(restaurant);
    await menuItemRepo.save(menuItem);
    return { restaurant, categoryId, menuItem };
  }

  it('updates name and price', async () => {
    const { menuItem } = await seed();

    const result = await useCase.execute({
      itemId: menuItem.id.toString(),
      actorId: 'owner-1',
      name: 'Paneer Tikka Masala',
      price: { amount: 30000, currency: 'INR' },
    });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().name).toBe('Paneer Tikka Masala');
    expect(result.getValue().basePrice.amount).toBe(30000);

    const updated = await menuItemRepo.findById(menuItem.id.toString());
    expect(updated!.name).toBe('Paneer Tikka Masala');

    expect(eventBus.publishedEvents.length).toBeGreaterThan(0);
    expect(eventBus.publishedEvents.length).toBeGreaterThan(0);
  });

  it('moves the item to another category of the same restaurant', async () => {
    const { restaurant, menuItem } = await seed();
    const newCategory = restaurant.addCategory('Desserts').getValue();
    restaurant.pullDomainEvents();
    await restaurantRepo.update(restaurant);

    const result = await useCase.execute({
      itemId: menuItem.id.toString(),
      actorId: 'owner-1',
      categoryId: newCategory.id.toString(),
    });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().categoryId).toBe(newCategory.id.toString());
  });

  it('fails with NotFoundError when menu item does not exist', async () => {
    const result = await useCase.execute({ itemId: 'missing', actorId: 'owner-1', name: 'New Name' });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
  });

  it('fails with ForbiddenError when actor is not the owner', async () => {
    const { menuItem } = await seed();

    const result = await useCase.execute({
      itemId: menuItem.id.toString(),
      actorId: 'someone-else',
      name: 'New Name',
    });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ForbiddenError);
  });

  it('fails with NotFoundError when the new categoryId does not belong to the restaurant', async () => {
    const { menuItem } = await seed();

    const result = await useCase.execute({
      itemId: menuItem.id.toString(),
      actorId: 'owner-1',
      categoryId: 'does-not-exist',
    });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
  });

  it('fails with ValidationError for an invalid price', async () => {
    const { menuItem } = await seed();

    const result = await useCase.execute({
      itemId: menuItem.id.toString(),
      actorId: 'owner-1',
      price: { amount: -50 },
    });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
    expect(eventBus.publishedEvents).toHaveLength(0);
    expect(eventBus.publishedEvents).toHaveLength(0);
  });
});
