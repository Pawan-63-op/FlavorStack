import { ManageDeliveryZone } from '../../../../application/catalog/use-cases/ManageDeliveryZone';
import { InMemoryRestaurantRepository } from '../../../mocks/catalog.mocks';
import { InMemoryUnitOfWork, InMemoryOutboxStore } from '../../../mocks/identity.mocks';
import { createEventBusSpy, EventBusSpy } from '../../../mocks/shared.mocks';
import { buildRestaurant, buildPolygon, buildFeeMatrix, money } from './helpers';
import { DELIVERY_ZONE_ACTION } from '../../../../application/catalog/dtos/ManageDeliveryZoneDto';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';

const POLYGON = [
  { lat: 0, lng: 0 },
  { lat: 0, lng: 1 },
  { lat: 1, lng: 1 },
  { lat: 1, lng: 0 },
];

const FEE_MATRIX = {
  tiers: [{ maxDistanceMeters: 2000, fee: { amount: 2000 } }],
};

describe('ManageDeliveryZone use-case', () => {
  let restaurantRepo: InMemoryRestaurantRepository;
  let unitOfWork: InMemoryUnitOfWork;
  let outboxStore: InMemoryOutboxStore;
  let eventBus: EventBusSpy;
  let useCase: ManageDeliveryZone;

  beforeEach(() => {
    restaurantRepo = new InMemoryRestaurantRepository();
    unitOfWork = new InMemoryUnitOfWork();
    outboxStore = new InMemoryOutboxStore();
    eventBus = createEventBusSpy();
    useCase = new ManageDeliveryZone(restaurantRepo, unitOfWork, outboxStore, eventBus);
  });

  function seedZone(restaurant: ReturnType<typeof buildRestaurant>) {
    const zone = restaurant
      .addZone({ polygon: buildPolygon(), feeMatrix: buildFeeMatrix(), minOrder: money(10000) })
      .getValue();
    restaurant.pullDomainEvents();
    return zone;
  }

  it('adds a new delivery zone', async () => {
    const restaurant = buildRestaurant();
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({
      restaurantId: restaurant.id.toString(),
      actorId: 'owner-1',
      action: DELIVERY_ZONE_ACTION.ADD,
      polygon: POLYGON,
      feeMatrix: FEE_MATRIX,
      minOrder: { amount: 10000 },
    });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().deliveryZones).toHaveLength(1);
    expect(result.getValue().deliveryZones[0].minOrder.amount).toBe(10000);

    expect(outboxStore.appended).toHaveLength(1);
    expect(outboxStore.appended[0].eventName).toBe('DeliveryZoneChanged');
    expect(eventBus.publishedEvents).toHaveLength(1);
  });

  it('updates an existing delivery zone', async () => {
    const restaurant = buildRestaurant();
    const zone = seedZone(restaurant);
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({
      restaurantId: restaurant.id.toString(),
      actorId: 'owner-1',
      action: DELIVERY_ZONE_ACTION.UPDATE,
      zoneId: zone.id.toString(),
      minOrder: { amount: 15000 },
    });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().deliveryZones[0].minOrder.amount).toBe(15000);
  });

  it('removes a delivery zone', async () => {
    const restaurant = buildRestaurant();
    const zone = seedZone(restaurant);
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({
      restaurantId: restaurant.id.toString(),
      actorId: 'owner-1',
      action: DELIVERY_ZONE_ACTION.REMOVE,
      zoneId: zone.id.toString(),
    });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().deliveryZones).toHaveLength(0);
  });

  it('fails with NotFoundError when restaurant does not exist', async () => {
    const result = await useCase.execute({
      restaurantId: 'missing',
      actorId: 'owner-1',
      action: DELIVERY_ZONE_ACTION.ADD,
      polygon: POLYGON,
      feeMatrix: FEE_MATRIX,
      minOrder: { amount: 10000 },
    });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
  });

  it('fails with ForbiddenError when actor is not the owner', async () => {
    const restaurant = buildRestaurant();
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({
      restaurantId: restaurant.id.toString(),
      actorId: 'someone-else',
      action: DELIVERY_ZONE_ACTION.ADD,
      polygon: POLYGON,
      feeMatrix: FEE_MATRIX,
      minOrder: { amount: 10000 },
    });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ForbiddenError);
  });

  it('fails with ValidationError when ADD is missing required fields', async () => {
    const restaurant = buildRestaurant();
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({
      restaurantId: restaurant.id.toString(),
      actorId: 'owner-1',
      action: DELIVERY_ZONE_ACTION.ADD,
    });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
    expect(outboxStore.appended).toHaveLength(0);
    expect(eventBus.publishedEvents).toHaveLength(0);
  });

  it('fails with ValidationError when UPDATE/REMOVE is missing zoneId', async () => {
    const restaurant = buildRestaurant();
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({
      restaurantId: restaurant.id.toString(),
      actorId: 'owner-1',
      action: DELIVERY_ZONE_ACTION.REMOVE,
    });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });
});
