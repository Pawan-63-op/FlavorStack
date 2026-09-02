import { UpdateCategory } from '../../../../application/catalog/use-cases/UpdateCategory';
import { InMemoryRestaurantRepository } from '../../../mocks/catalog.mocks';
import { InMemoryUnitOfWork } from '../../../mocks/identity.mocks';
import { createEventBusSpy, EventBusSpy } from '../../../mocks/shared.mocks';
import { buildRestaurant } from './helpers';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';
import { ConflictError } from '../../../../domain/shared/errors/ConflictError';

describe('UpdateCategory use-case', () => {
  let restaurantRepo: InMemoryRestaurantRepository;
  let unitOfWork: InMemoryUnitOfWork;
  let eventBus: EventBusSpy;
  let useCase: UpdateCategory;

  beforeEach(() => {
    restaurantRepo = new InMemoryRestaurantRepository();
    unitOfWork = new InMemoryUnitOfWork();
    eventBus = createEventBusSpy();
    useCase = new UpdateCategory(restaurantRepo, unitOfWork, eventBus);
  });

  it('updates the category label', async () => {
    const restaurant = buildRestaurant();
    const categoryId = restaurant.categories[0].id.toString();
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({
      restaurantId: restaurant.id.toString(),
      actorId: 'owner-1',
      categoryId,
      label: 'Starters',
    });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().categories.find((c) => c.id === categoryId)?.label).toBe('Starters');

    expect(eventBus.publishedEvents).toHaveLength(1);
    expect(eventBus.publishedEvents[0].eventName).toBe('CategoryUpdated');
    expect(eventBus.publishedEvents).toHaveLength(1);
  });

  it('fails with NotFoundError when restaurant does not exist', async () => {
    const result = await useCase.execute({
      restaurantId: 'missing',
      actorId: 'owner-1',
      categoryId: 'cat-1',
      label: 'Starters',
    });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
  });

  it('fails with NotFoundError when category does not exist', async () => {
    const restaurant = buildRestaurant();
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({
      restaurantId: restaurant.id.toString(),
      actorId: 'owner-1',
      categoryId: 'does-not-exist',
      label: 'Starters',
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
      label: 'Starters',
    });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ForbiddenError);
  });

  it('fails with ConflictError when deactivating the last active category of an ACTIVE restaurant', async () => {
    const restaurant = buildRestaurant();
    const categoryId = restaurant.categories[0].id.toString();
    restaurant.publish();
    restaurant.pullDomainEvents();
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({
      restaurantId: restaurant.id.toString(),
      actorId: 'owner-1',
      categoryId,
      isActive: false,
    });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ConflictError);
    expect(eventBus.publishedEvents).toHaveLength(0);
    expect(eventBus.publishedEvents).toHaveLength(0);
  });
});
