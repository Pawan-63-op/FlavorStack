import { SetOpeningHours } from '../../../../application/catalog/use-cases/SetOpeningHours';
import { InMemoryRestaurantRepository } from '../../../mocks/catalog.mocks';
import { InMemoryUnitOfWork } from '../../../mocks/identity.mocks';
import { createEventBusSpy, EventBusSpy } from '../../../mocks/shared.mocks';
import { buildRestaurant } from './helpers';
import { WeeklySchedule } from '../../../../domain/catalog/value-objects/OpeningHours.vo';
import { WEEKDAY } from '../../../../domain/catalog/enums/weekday.enum';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';

function schedule(interval: { open: string; close: string }): WeeklySchedule {
  const day = [interval];
  return {
    [WEEKDAY.MONDAY]: day,
    [WEEKDAY.TUESDAY]: day,
    [WEEKDAY.WEDNESDAY]: day,
    [WEEKDAY.THURSDAY]: day,
    [WEEKDAY.FRIDAY]: day,
    [WEEKDAY.SATURDAY]: day,
    [WEEKDAY.SUNDAY]: [],
  } as WeeklySchedule;
}

describe('SetOpeningHours use-case', () => {
  let restaurantRepo: InMemoryRestaurantRepository;
  let unitOfWork: InMemoryUnitOfWork;
  let eventBus: EventBusSpy;
  let useCase: SetOpeningHours;

  beforeEach(() => {
    restaurantRepo = new InMemoryRestaurantRepository();
    unitOfWork = new InMemoryUnitOfWork();
    eventBus = createEventBusSpy();
    useCase = new SetOpeningHours(restaurantRepo, unitOfWork, eventBus);
  });

  it('sets the weekly schedule and emits RestaurantUpdated', async () => {
    const restaurant = buildRestaurant();
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({
      restaurantId: restaurant.id.toString(),
      actorId: 'owner-1',
      schedule: schedule({ open: '09:00', close: '22:00' }),
    });

    expect(result.isSuccess).toBe(true);
    expect(eventBus.publishedEvents).toHaveLength(1);
    expect(eventBus.publishedEvents[0].eventName).toBe('RestaurantUpdated');
  });

  it('fails with NotFoundError when the restaurant does not exist', async () => {
    const result = await useCase.execute({
      restaurantId: 'missing',
      actorId: 'owner-1',
      schedule: schedule({ open: '09:00', close: '22:00' }),
    });
    expect(result.getError()).toBeInstanceOf(NotFoundError);
  });

  it('fails with ForbiddenError when the actor is not the owner', async () => {
    const restaurant = buildRestaurant();
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({
      restaurantId: restaurant.id.toString(),
      actorId: 'intruder',
      schedule: schedule({ open: '09:00', close: '22:00' }),
    });
    expect(result.getError()).toBeInstanceOf(ForbiddenError);
  });

  it('fails when an interval closes before it opens (invalid schedule)', async () => {
    const restaurant = buildRestaurant();
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({
      restaurantId: restaurant.id.toString(),
      actorId: 'owner-1',
      schedule: schedule({ open: '22:00', close: '09:00' }),
    });

    expect(result.isFailure).toBe(true);
    expect(eventBus.publishedEvents).toHaveLength(0);
  });
});
