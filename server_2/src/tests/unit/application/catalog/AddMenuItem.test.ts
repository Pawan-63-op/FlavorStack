import { AddMenuItem } from '../../../../application/catalog/use-cases/AddMenuItem';
import { InMemoryRestaurantRepository, InMemoryMenuItemRepository } from '../../../mocks/catalog.mocks';
import { InMemoryUnitOfWork, InMemoryOutboxStore } from '../../../mocks/identity.mocks';
import { createEventBusSpy, EventBusSpy } from '../../../mocks/shared.mocks';
import { buildRestaurant } from './helpers';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';

describe('AddMenuItem use-case', () => {
  let restaurantRepo: InMemoryRestaurantRepository;
  let menuItemRepo: InMemoryMenuItemRepository;
  let unitOfWork: InMemoryUnitOfWork;
  let outboxStore: InMemoryOutboxStore;
  let eventBus: EventBusSpy;
  let useCase: AddMenuItem;

  beforeEach(() => {
    restaurantRepo = new InMemoryRestaurantRepository();
    menuItemRepo = new InMemoryMenuItemRepository();
    unitOfWork = new InMemoryUnitOfWork();
    outboxStore = new InMemoryOutboxStore();
    eventBus = createEventBusSpy();
    useCase = new AddMenuItem(restaurantRepo, menuItemRepo, unitOfWork, outboxStore, eventBus);
  });

  it('creates a menu item under an existing category', async () => {
    const restaurant = buildRestaurant();
    const categoryId = restaurant.categories[0].id.toString();
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({
      restaurantId: restaurant.id.toString(),
      actorId: 'owner-1',
      categoryId,
      name: 'Paneer Tikka',
      basePrice: { amount: 25000, currency: 'INR' },
    });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().name).toBe('Paneer Tikka');
    expect(result.getValue().categoryId).toBe(categoryId);

    const saved = await menuItemRepo.findById(result.getValue().id);
    expect(saved).not.toBeNull();

    expect(outboxStore.appended).toHaveLength(1);
    expect(outboxStore.appended[0].eventName).toBe('MenuItemCreated');
    expect(eventBus.publishedEvents).toHaveLength(1);
  });

  it('fails with NotFoundError when restaurant does not exist', async () => {
    const result = await useCase.execute({
      restaurantId: 'missing',
      actorId: 'owner-1',
      categoryId: 'cat-1',
      name: 'Paneer Tikka',
      basePrice: { amount: 25000 },
    });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
  });

  it('fails with ForbiddenError when actor is not the owner', async () => {
    const restaurant = buildRestaurant();
    const categoryId = restaurant.categories[0].id.toString();
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({
      restaurantId: restaurant.id.toString(),
      actorId: 'someone-else',
      categoryId,
      name: 'Paneer Tikka',
      basePrice: { amount: 25000 },
    });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ForbiddenError);
  });

  it('fails with NotFoundError when categoryId does not belong to the restaurant', async () => {
    const restaurant = buildRestaurant();
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({
      restaurantId: restaurant.id.toString(),
      actorId: 'owner-1',
      categoryId: 'does-not-exist',
      name: 'Paneer Tikka',
      basePrice: { amount: 25000 },
    });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
  });

  it('fails with ValidationError for an invalid basePrice', async () => {
    const restaurant = buildRestaurant();
    const categoryId = restaurant.categories[0].id.toString();
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({
      restaurantId: restaurant.id.toString(),
      actorId: 'owner-1',
      categoryId,
      name: 'Paneer Tikka',
      basePrice: { amount: -100 },
    });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
    expect(outboxStore.appended).toHaveLength(0);
    expect(eventBus.publishedEvents).toHaveLength(0);
  });
});
