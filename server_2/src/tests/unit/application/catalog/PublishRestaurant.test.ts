import { PublishRestaurant } from '../../../../application/catalog/use-cases/PublishRestaurant';
import { InMemoryRestaurantRepository } from '../../../mocks/catalog.mocks';
import { InMemoryUnitOfWork, InMemoryOutboxStore } from '../../../mocks/identity.mocks';
import { createEventBusSpy, EventBusSpy } from '../../../mocks/shared.mocks';
import { buildRestaurant, buildAddress } from './helpers';
import { Restaurant } from '../../../../domain/catalog/entities/Restaurant';
import { GeoPoint } from '../../../../domain/identity/value-objects/GeoPoint.vo';
import { CUISINE_TYPE } from '../../../../domain/catalog/enums/cuisine-type.enum';
import { RESTAURANT_STATUS } from '../../../../domain/catalog/enums/restaurant-status.enum';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';

/** A DRAFT restaurant with no categories — cannot be published. */
function buildCategorylessRestaurant(): Restaurant {
  const restaurant = Restaurant.create({
    ownerId: 'owner-1',
    name: 'No Menu Yet',
    cuisineTypes: [CUISINE_TYPE.NORTH_INDIAN],
    address: buildAddress(),
    location: GeoPoint.create(12.97, 77.59).getValue(),
    phone: '+919876543210',
  }).getValue();
  restaurant.pullDomainEvents();
  return restaurant;
}

describe('PublishRestaurant use-case', () => {
  let restaurantRepo: InMemoryRestaurantRepository;
  let unitOfWork: InMemoryUnitOfWork;
  let outboxStore: InMemoryOutboxStore;
  let eventBus: EventBusSpy;
  let useCase: PublishRestaurant;

  beforeEach(() => {
    restaurantRepo = new InMemoryRestaurantRepository();
    unitOfWork = new InMemoryUnitOfWork();
    outboxStore = new InMemoryOutboxStore();
    eventBus = createEventBusSpy();
    useCase = new PublishRestaurant(restaurantRepo, unitOfWork, outboxStore, eventBus);
  });

  it('publishes a DRAFT restaurant with an active category and emits RestaurantStatusChanged', async () => {
    const restaurant = buildRestaurant();
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({ restaurantId: restaurant.id.toString(), actorId: 'owner-1' });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().status).toBe(RESTAURANT_STATUS.ACTIVE);
    expect(outboxStore.appended).toHaveLength(1);
    expect(outboxStore.appended[0].eventName).toBe('RestaurantStatusChanged');
    expect(eventBus.publishedEvents).toHaveLength(1);
  });

  it('fails with NotFoundError when the restaurant does not exist', async () => {
    const result = await useCase.execute({ restaurantId: 'missing', actorId: 'owner-1' });
    expect(result.getError()).toBeInstanceOf(NotFoundError);
  });

  it('fails with ForbiddenError when the actor is not the owner', async () => {
    const restaurant = buildRestaurant();
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({ restaurantId: restaurant.id.toString(), actorId: 'intruder' });
    expect(result.getError()).toBeInstanceOf(ForbiddenError);
    expect(outboxStore.appended).toHaveLength(0);
  });

  it('fails with ValidationError when there is no active category (publish invariant)', async () => {
    const restaurant = buildCategorylessRestaurant();
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({ restaurantId: restaurant.id.toString(), actorId: 'owner-1' });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
    expect(outboxStore.appended).toHaveLength(0);
    expect(eventBus.publishedEvents).toHaveLength(0);
  });
});
