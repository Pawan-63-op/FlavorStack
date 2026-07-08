import { ListOwnerRestaurants } from '../../../../application/catalog/use-cases/ListOwnerRestaurants';
import { InMemoryRestaurantRepository } from '../../../mocks/catalog.mocks';
import { Restaurant } from '../../../../domain/catalog/entities/Restaurant';
import { buildAddress } from './helpers';
import { GeoPoint } from '../../../../domain/identity/value-objects/GeoPoint.vo';
import { CUISINE_TYPE } from '../../../../domain/catalog/enums/cuisine-type.enum';

function buildOwned(ownerId: string, name: string): Restaurant {
  const restaurant = Restaurant.create({
    ownerId,
    name,
    cuisineTypes: [CUISINE_TYPE.NORTH_INDIAN],
    address: buildAddress(),
    location: GeoPoint.create(12.97, 77.59).getValue(),
    phone: '+919876543210',
  }).getValue();
  restaurant.pullDomainEvents();
  return restaurant;
}

describe('ListOwnerRestaurants use-case', () => {
  let restaurantRepo: InMemoryRestaurantRepository;
  let useCase: ListOwnerRestaurants;

  beforeEach(() => {
    restaurantRepo = new InMemoryRestaurantRepository();
    useCase = new ListOwnerRestaurants(restaurantRepo);
  });

  it('returns only the actor-owned restaurants as full owner views', async () => {
    await restaurantRepo.save(buildOwned('owner-1', 'Spice Garden'));
    await restaurantRepo.save(buildOwned('owner-1', 'Curry House'));
    await restaurantRepo.save(buildOwned('owner-2', 'Other Diner'));

    const result = await useCase.execute({ actorId: 'owner-1' });

    expect(result.isSuccess).toBe(true);
    const page = result.getValue();
    expect(page.items).toHaveLength(2);
    expect(page.items.every((r) => r.ownerId === 'owner-1')).toBe(true);
    expect(page.items[0]).toHaveProperty('version');
    expect(page.items[0]).toHaveProperty('visibility');
  });

  it('returns an empty list for an actor that owns nothing', async () => {
    await restaurantRepo.save(buildOwned('owner-2', 'Other Diner'));

    const result = await useCase.execute({ actorId: 'owner-1' });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().items).toHaveLength(0);
  });

  it('forwards cursor pagination params to the repository', async () => {
    const spy = jest.spyOn(restaurantRepo, 'findByOwner');

    await useCase.execute({ actorId: 'owner-1', cursor: 'c1', limit: 10 });

    expect(spy).toHaveBeenCalledWith('owner-1', { cursor: 'c1', limit: 10 });
  });
});
