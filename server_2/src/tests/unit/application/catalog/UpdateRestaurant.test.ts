import { UpdateRestaurant } from '../../../../application/catalog/use-cases/UpdateRestaurant';
import { InMemoryRestaurantRepository } from '../../../mocks/catalog.mocks';
import { InMemoryUnitOfWork, InMemoryOutboxStore } from '../../../mocks/identity.mocks';
import { createEventBusSpy, EventBusSpy } from '../../../mocks/shared.mocks';
import { buildRestaurant } from './helpers';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';

describe('UpdateRestaurant use-case', () => {
  let restaurantRepo: InMemoryRestaurantRepository;
  let unitOfWork: InMemoryUnitOfWork;
  let outboxStore: InMemoryOutboxStore;
  let eventBus: EventBusSpy;
  let useCase: UpdateRestaurant;

  beforeEach(() => {
    restaurantRepo = new InMemoryRestaurantRepository();
    unitOfWork = new InMemoryUnitOfWork();
    outboxStore = new InMemoryOutboxStore();
    eventBus = createEventBusSpy();
    useCase = new UpdateRestaurant(restaurantRepo, unitOfWork, outboxStore, eventBus);
  });

  it('updates the profile and emits RestaurantUpdated', async () => {
    const restaurant = buildRestaurant();
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({
      restaurantId: restaurant.id.toString(),
      actorId: 'owner-1',
      name: 'Renamed Bistro',
    });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().name).toBe('Renamed Bistro');
    expect(outboxStore.appended).toHaveLength(1);
    expect(outboxStore.appended[0].eventName).toBe('RestaurantUpdated');
    expect(eventBus.publishedEvents).toHaveLength(1);
  });

  it('fails with NotFoundError when the restaurant does not exist', async () => {
    const result = await useCase.execute({ restaurantId: 'missing', actorId: 'owner-1', name: 'X' });
    expect(result.getError()).toBeInstanceOf(NotFoundError);
  });

  it('fails with ForbiddenError when the actor is not the owner', async () => {
    const restaurant = buildRestaurant();
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({
      restaurantId: restaurant.id.toString(),
      actorId: 'someone-else',
      name: 'X',
    });

    expect(result.getError()).toBeInstanceOf(ForbiddenError);
    expect(outboxStore.appended).toHaveLength(0);
  });

  it('allows a super-admin to update a restaurant they do not own', async () => {
    const restaurant = buildRestaurant();
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({
      restaurantId: restaurant.id.toString(),
      actorId: 'admin-9',
      isSuperAdmin: true,
      name: 'Moderated Name',
    });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().name).toBe('Moderated Name');
  });

  it('fails when the new location coordinates are invalid', async () => {
    const restaurant = buildRestaurant();
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({
      restaurantId: restaurant.id.toString(),
      actorId: 'owner-1',
      location: { lat: 999, lng: 0 },
    });

    expect(result.isFailure).toBe(true);
    expect(outboxStore.appended).toHaveLength(0);
  });
});
