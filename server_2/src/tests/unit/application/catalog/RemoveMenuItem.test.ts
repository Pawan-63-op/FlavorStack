import { RemoveMenuItem } from '../../../../application/catalog/use-cases/RemoveMenuItem';
import { InMemoryRestaurantRepository, InMemoryMenuItemRepository } from '../../../mocks/catalog.mocks';
import { InMemoryUnitOfWork } from '../../../mocks/identity.mocks';
import { buildRestaurant, buildMenuItem } from './helpers';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';
import { ConflictError } from '../../../../domain/shared/errors/ConflictError';

describe('RemoveMenuItem use-case', () => {
  let restaurantRepo: InMemoryRestaurantRepository;
  let menuItemRepo: InMemoryMenuItemRepository;
  let unitOfWork: InMemoryUnitOfWork;
  let useCase: RemoveMenuItem;

  beforeEach(() => {
    restaurantRepo = new InMemoryRestaurantRepository();
    menuItemRepo = new InMemoryMenuItemRepository();
    unitOfWork = new InMemoryUnitOfWork();
    useCase = new RemoveMenuItem(restaurantRepo, menuItemRepo, unitOfWork);
  });

  async function seed() {
    const restaurant = buildRestaurant();
    const categoryId = restaurant.categories[0].id.toString();
    const menuItem = buildMenuItem(restaurant.id.toString(), categoryId);
    await restaurantRepo.save(restaurant);
    await menuItemRepo.save(menuItem);
    return { restaurant, menuItem };
  }

  it('soft-deletes a menu item', async () => {
    const { menuItem } = await seed();

    const result = await useCase.execute({ itemId: menuItem.id.toString(), actorId: 'owner-1' });

    expect(result.isSuccess).toBe(true);

    const found = await menuItemRepo.findById(menuItem.id.toString());
    expect(found).toBeNull();
  });

  it('fails with NotFoundError when menu item does not exist', async () => {
    const result = await useCase.execute({ itemId: 'missing', actorId: 'owner-1' });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
  });

  it('fails with ForbiddenError when actor is not the owner', async () => {
    const { menuItem } = await seed();

    const result = await useCase.execute({ itemId: menuItem.id.toString(), actorId: 'someone-else' });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ForbiddenError);
  });

  it('fails with ConflictError when the menu item is already deleted', async () => {
    const { menuItem } = await seed();
    menuItem.softDelete();

    const result = await useCase.execute({ itemId: menuItem.id.toString(), actorId: 'owner-1' });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ConflictError);
  });
});
