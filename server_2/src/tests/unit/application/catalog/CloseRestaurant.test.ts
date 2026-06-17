import { CloseRestaurant } from '../../../../application/catalog/use-cases/CloseRestaurant';
import { InMemoryRestaurantRepository } from '../../../mocks/catalog.mocks';
import { InMemoryUnitOfWork, InMemoryOutboxStore } from '../../../mocks/identity.mocks';
import { createEventBusSpy, EventBusSpy } from '../../../mocks/shared.mocks';
import { buildRestaurant } from './helpers';
import { RESTAURANT_STATUS } from '../../../../domain/catalog/enums/restaurant-status.enum';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';

describe('CloseRestaurant use-case', () => {
  let restaurantRepo: InMemoryRestaurantRepository;
  let unitOfWork: InMemoryUnitOfWork;
  let outboxStore: InMemoryOutboxStore;
  let eventBus: EventBusSpy;
  let useCase: CloseRestaurant;

  beforeEach(() => {
    restaurantRepo = new InMemoryRestaurantRepository();
    unitOfWork = new InMemoryUnitOfWork();
    outboxStore = new InMemoryOutboxStore();
    eventBus = createEventBusSpy();
    useCase = new CloseRestaurant(restaurantRepo, unitOfWork, outboxStore, eventBus);
  });

  it('transitions an ACTIVE restaurant to CLOSED', async () => {
    const restaurant = buildRestaurant();
    restaurant.publish();
    restaurant.pullDomainEvents();
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({ restaurantId: restaurant.id.toString(), actorId: 'owner-1' });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().status).toBe(RESTAURANT_STATUS.CLOSED);

    const updated = await restaurantRepo.findById(restaurant.id.toString());
    expect(updated!.status.value).toBe(RESTAURANT_STATUS.CLOSED);

    expect(outboxStore.appended).toHaveLength(1);
    expect(outboxStore.appended[0].eventName).toBe('RestaurantStatusChanged');
    expect(eventBus.publishedEvents).toHaveLength(1);
  });

  it('fails with NotFoundError when restaurant does not exist', async () => {
    const result = await useCase.execute({ restaurantId: 'missing', actorId: 'owner-1' });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
  });

  it('fails with ForbiddenError when actor is not the owner', async () => {
    const restaurant = buildRestaurant();
    restaurant.publish();
    restaurant.pullDomainEvents();
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({ restaurantId: restaurant.id.toString(), actorId: 'someone-else' });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ForbiddenError);
  });

  it('fails with ValidationError when restaurant is still DRAFT', async () => {
    const restaurant = buildRestaurant();
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({ restaurantId: restaurant.id.toString(), actorId: 'owner-1' });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
    expect(outboxStore.appended).toHaveLength(0);
    expect(eventBus.publishedEvents).toHaveLength(0);
  });
});
