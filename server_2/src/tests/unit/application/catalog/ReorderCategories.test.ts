import { ReorderCategories } from '../../../../application/catalog/use-cases/ReorderCategories';
import { InMemoryRestaurantRepository } from '../../../mocks/catalog.mocks';
import { InMemoryUnitOfWork, InMemoryOutboxStore } from '../../../mocks/identity.mocks';
import { createEventBusSpy, EventBusSpy } from '../../../mocks/shared.mocks';
import { buildRestaurant } from './helpers';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';

describe('ReorderCategories use-case', () => {
  let restaurantRepo: InMemoryRestaurantRepository;
  let unitOfWork: InMemoryUnitOfWork;
  let outboxStore: InMemoryOutboxStore;
  let eventBus: EventBusSpy;
  let useCase: ReorderCategories;

  beforeEach(() => {
    restaurantRepo = new InMemoryRestaurantRepository();
    unitOfWork = new InMemoryUnitOfWork();
    outboxStore = new InMemoryOutboxStore();
    eventBus = createEventBusSpy();
    useCase = new ReorderCategories(restaurantRepo, unitOfWork, outboxStore, eventBus);
  });

  it('reorders the restaurant categories', async () => {
    const restaurant = buildRestaurant();
    const dessertsResult = restaurant.addCategory('Desserts');
    restaurant.pullDomainEvents();
    const mainsId = restaurant.categories[0].id.toString();
    const dessertsId = dessertsResult.getValue().id.toString();
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({
      restaurantId: restaurant.id.toString(),
      actorId: 'owner-1',
      orderedCategoryIds: [dessertsId, mainsId],
    });

    expect(result.isSuccess).toBe(true);
    const categories = result.getValue().categories;
    expect(categories.find((c) => c.id === dessertsId)?.sortOrder).toBe(0);
    expect(categories.find((c) => c.id === mainsId)?.sortOrder).toBe(1);

    expect(outboxStore.appended).toHaveLength(1);
    expect(outboxStore.appended[0].eventName).toBe('CategoryUpdated');
    expect(eventBus.publishedEvents).toHaveLength(1);
  });

  it('fails with NotFoundError when restaurant does not exist', async () => {
    const result = await useCase.execute({
      restaurantId: 'missing',
      actorId: 'owner-1',
      orderedCategoryIds: [],
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
      orderedCategoryIds: [categoryId],
    });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ForbiddenError);
  });

  it('fails with ValidationError when ordered ids do not match existing categories', async () => {
    const restaurant = buildRestaurant();
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({
      restaurantId: restaurant.id.toString(),
      actorId: 'owner-1',
      orderedCategoryIds: ['unknown-id'],
    });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
    expect(outboxStore.appended).toHaveLength(0);
    expect(eventBus.publishedEvents).toHaveLength(0);
  });
});
