import { DeleteRestaurant } from '../../../../application/catalog/use-cases/DeleteRestaurant';
import { InMemoryRestaurantRepository } from '../../../mocks/catalog.mocks';
import { InMemoryUnitOfWork } from '../../../mocks/identity.mocks';
import { buildRestaurant } from './helpers';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';

describe('DeleteRestaurant use-case', () => {
  let restaurantRepo: InMemoryRestaurantRepository;
  let unitOfWork: InMemoryUnitOfWork;
  let useCase: DeleteRestaurant;

  beforeEach(() => {
    restaurantRepo = new InMemoryRestaurantRepository();
    unitOfWork = new InMemoryUnitOfWork();
    useCase = new DeleteRestaurant(restaurantRepo, unitOfWork);
  });

  it('soft-deletes the restaurant for its owner', async () => {
    const restaurant = buildRestaurant();
    await restaurantRepo.save(restaurant);

    const result = await useCase.execute({ restaurantId: restaurant.id.toString(), actorId: 'owner-1' });

    expect(result.isSuccess).toBe(true);
    const stored = await restaurantRepo.findById(restaurant.id.toString());
    expect(stored!.deletedAt).not.toBeNull();
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
  });
});
