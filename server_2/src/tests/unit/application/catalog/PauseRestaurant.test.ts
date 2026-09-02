import { PauseRestaurant } from '../../../../application/catalog/use-cases/PauseRestaurant';
import { InMemoryRestaurantRepository } from '../../../mocks/catalog.mocks';
import { InMemoryUnitOfWork } from '../../../mocks/identity.mocks';
import { createEventBusSpy, EventBusSpy } from '../../../mocks/shared.mocks';
import { buildRestaurant } from './helpers';
import { RESTAURANT_STATUS } from '../../../../domain/catalog/enums/restaurant-status.enum';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';

describe('PauseRestaurant use-case', () => {
  let restaurantRepo: InMemoryRestaurantRepository;
  let unitOfWork: InMemoryUnitOfWork;
  let eventBus: EventBusSpy;
  let useCase: PauseRestaurant;

  beforeEach(() => {
    restaurantRepo = new InMemoryRestaurantRepository();
    unitOfWork = new InMemoryUnitOfWork();
    eventBus = createEventBusSpy();
    useCase = new PauseRestaurant(restaurantRepo, unitOfWork, eventBus);
  });

  it('pauses an ACTIVE restaurant and emits RestaurantStatusChanged', async () => {
    const restaurant = buildRestaurant();
    restaurant.publish();
    restaurant.pullDomainEvents();
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({ restaurantId: restaurant.id.toString(), actorId: 'owner-1' });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().status).toBe(RESTAURANT_STATUS.PAUSED);
    expect(eventBus.publishedEvents).toHaveLength(1);
    expect(eventBus.publishedEvents[0].eventName).toBe('RestaurantStatusChanged');
  });

  it('fails with NotFoundError when the restaurant does not exist', async () => {
    const result = await useCase.execute({ restaurantId: 'missing', actorId: 'owner-1' });
    expect(result.getError()).toBeInstanceOf(NotFoundError);
  });

  it('fails with ForbiddenError when the actor is not the owner', async () => {
    const restaurant = buildRestaurant();
    restaurant.publish();
    restaurant.pullDomainEvents();
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({ restaurantId: restaurant.id.toString(), actorId: 'intruder' });
    expect(result.getError()).toBeInstanceOf(ForbiddenError);
  });

  it('fails with ValidationError when the restaurant is still DRAFT (cannot pause)', async () => {
    const restaurant = buildRestaurant();
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({ restaurantId: restaurant.id.toString(), actorId: 'owner-1' });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
    expect(eventBus.publishedEvents).toHaveLength(0);
  });
});
