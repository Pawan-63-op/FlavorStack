import { AddCategory } from '../../../../application/catalog/use-cases/AddCategory';
import { InMemoryRestaurantRepository } from '../../../mocks/catalog.mocks';
import { InMemoryUnitOfWork, InMemoryOutboxStore } from '../../../mocks/identity.mocks';
import { createEventBusSpy, EventBusSpy } from '../../../mocks/shared.mocks';
import { buildRestaurant } from './helpers';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';

describe('AddCategory use-case', () => {
  let restaurantRepo: InMemoryRestaurantRepository;
  let unitOfWork: InMemoryUnitOfWork;
  let outboxStore: InMemoryOutboxStore;
  let eventBus: EventBusSpy;
  let useCase: AddCategory;

  beforeEach(() => {
    restaurantRepo = new InMemoryRestaurantRepository();
    unitOfWork = new InMemoryUnitOfWork();
    outboxStore = new InMemoryOutboxStore();
    eventBus = createEventBusSpy();
    useCase = new AddCategory(restaurantRepo, unitOfWork, outboxStore, eventBus);
  });

  it('adds a new category to the restaurant', async () => {
    const restaurant = buildRestaurant();
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({
      restaurantId: restaurant.id.toString(),
      actorId: 'owner-1',
      label: 'Desserts',
    });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().categories.map((c) => c.label)).toContain('Desserts');

    const updated = await restaurantRepo.findById(restaurant.id.toString());
    expect(updated!.categories).toHaveLength(2);

    expect(outboxStore.appended).toHaveLength(1);
    expect(outboxStore.appended[0].eventName).toBe('CategoryAdded');
    expect(eventBus.publishedEvents).toHaveLength(1);
  });

  it('fails with NotFoundError when restaurant does not exist', async () => {
    const result = await useCase.execute({ restaurantId: 'missing', actorId: 'owner-1', label: 'Desserts' });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
  });

  it('fails with ForbiddenError when actor is not the owner', async () => {
    const restaurant = buildRestaurant();
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({
      restaurantId: restaurant.id.toString(),
      actorId: 'someone-else',
      label: 'Desserts',
    });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ForbiddenError);
  });

  it('fails with ValidationError for an empty label', async () => {
    const restaurant = buildRestaurant();
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({
      restaurantId: restaurant.id.toString(),
      actorId: 'owner-1',
      label: '   ',
    });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
    expect(outboxStore.appended).toHaveLength(0);
    expect(eventBus.publishedEvents).toHaveLength(0);
  });
});
