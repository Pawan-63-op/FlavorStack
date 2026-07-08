import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoRestaurantRepository } from '../../../infrastructure/repositories/RestaurantRepository';
import { MongoDeliveryZoneRepository } from '../../../infrastructure/repositories/DeliveryZoneRepository';
import { RestaurantModel } from '../../../infrastructure/database/models/RestaurantModel';
import { buildRestaurant } from './catalog-fixtures';
import { randomUUID } from 'crypto';

describe('MongoDeliveryZoneRepository.findZoneContaining', () => {
  let txContext: TransactionContext;
  let restaurantRepo: MongoRestaurantRepository;
  let zoneRepo: MongoDeliveryZoneRepository;

  beforeAll(async () => {
    await RestaurantModel.init();
  });

  beforeEach(() => {
    txContext = new TransactionContext();
    restaurantRepo = new MongoRestaurantRepository(txContext);
    zoneRepo = new MongoDeliveryZoneRepository(txContext);
  });

  afterEach(async () => {
    await RestaurantModel.deleteMany({});
  });

  it('returns the zone whose polygon contains the point', async () => {
    const centerLat = 18.52;
    const centerLng = 73.85;
    const restaurant = buildRestaurant({
      slug: `r-${randomUUID().slice(0, 8)}`,
      withZone: true,
      centerLat,
      centerLng,
    });
    await restaurantRepo.save(restaurant);

    const inside = GeoPoint.create(centerLat, centerLng).getValue();
    const zones = await zoneRepo.findZoneContaining(inside);

    expect(zones).toHaveLength(1);
    expect(zones[0].id.toString()).toBe(restaurant.deliveryZones[0].id.toString());
  });

  it('returns no zone for a point outside every polygon', async () => {
    const restaurant = buildRestaurant({
      slug: `r-${randomUUID().slice(0, 8)}`,
      withZone: true,
      centerLat: 18.52,
      centerLng: 73.85,
    });
    await restaurantRepo.save(restaurant);

    const faraway = GeoPoint.create(19.99, 72.99).getValue();
    const zones = await zoneRepo.findZoneContaining(faraway);

    expect(zones).toHaveLength(0);
  });

  it('ignores zones of soft-deleted restaurants', async () => {
    const centerLat = 18.52;
    const centerLng = 73.85;
    const restaurant = buildRestaurant({
      slug: `r-${randomUUID().slice(0, 8)}`,
      withZone: true,
      centerLat,
      centerLng,
    });
    await restaurantRepo.save(restaurant);
    await restaurantRepo.softDelete(restaurant.id.toString());

    const inside = GeoPoint.create(centerLat, centerLng).getValue();
    const zones = await zoneRepo.findZoneContaining(inside);
    expect(zones).toHaveLength(0);
  });
});
