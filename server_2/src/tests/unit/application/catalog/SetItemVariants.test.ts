import { SetItemVariants } from '../../../../application/catalog/use-cases/SetItemVariants';
import { InMemoryRestaurantRepository, InMemoryMenuItemRepository } from '../../../mocks/catalog.mocks';
import { InMemoryUnitOfWork } from '../../../mocks/identity.mocks';
import { createEventBusSpy, EventBusSpy } from '../../../mocks/shared.mocks';
import { buildRestaurant, buildMenuItem } from './helpers';
import { VARIANT_SELECTION_TYPE } from '../../../../domain/catalog/enums/variant-selection-type.enum';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';

describe('SetItemVariants use-case', () => {
  let restaurantRepo: InMemoryRestaurantRepository;
  let menuItemRepo: InMemoryMenuItemRepository;
  let unitOfWork: InMemoryUnitOfWork;
  let eventBus: EventBusSpy;
  let useCase: SetItemVariants;

  beforeEach(() => {
    restaurantRepo = new InMemoryRestaurantRepository();
    menuItemRepo = new InMemoryMenuItemRepository();
    unitOfWork = new InMemoryUnitOfWork();
    eventBus = createEventBusSpy();
    useCase = new SetItemVariants(restaurantRepo, menuItemRepo, unitOfWork, eventBus);
  });

  async function seed() {
    const restaurant = buildRestaurant();
    const categoryId = restaurant.categories[0].id.toString();
    const menuItem = buildMenuItem(restaurant.id.toString(), categoryId);
    await restaurantRepo.save(restaurant);
    await menuItemRepo.save(menuItem);
    return { restaurant, menuItem };
  }

  it('sets variant groups with options', async () => {
    const { menuItem } = await seed();

    const result = await useCase.execute({
      itemId: menuItem.id.toString(),
      actorId: 'owner-1',
      groups: [
        {
          label: 'Size',
          selectionType: VARIANT_SELECTION_TYPE.SINGLE,
          required: true,
          minSelect: 1,
          maxSelect: 1,
          options: [
            { label: 'Regular', priceDelta: { amount: 0 }, isDefault: true },
            { label: 'Large', priceDelta: { amount: 5000 } },
          ],
        },
      ],
    });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().variantGroups).toHaveLength(1);
    expect(result.getValue().variantGroups[0].options).toHaveLength(2);
    expect(result.getValue().variantGroups[0].options[1].priceDelta.amount).toBe(5000);

    expect(eventBus.publishedEvents).toHaveLength(1);
    expect(eventBus.publishedEvents[0].eventName).toBe('MenuItemUpdated');
    expect(eventBus.publishedEvents).toHaveLength(1);
  });

  it('fails with NotFoundError when menu item does not exist', async () => {
    const result = await useCase.execute({ itemId: 'missing', actorId: 'owner-1', groups: [] });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
  });

  it('fails with ForbiddenError when actor is not the owner', async () => {
    const { menuItem } = await seed();

    const result = await useCase.execute({ itemId: menuItem.id.toString(), actorId: 'someone-else', groups: [] });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ForbiddenError);
  });

  it('fails with ValidationError for an invalid SINGLE selection group (maxSelect != 1)', async () => {
    const { menuItem } = await seed();

    const result = await useCase.execute({
      itemId: menuItem.id.toString(),
      actorId: 'owner-1',
      groups: [
        {
          label: 'Size',
          selectionType: VARIANT_SELECTION_TYPE.SINGLE,
          minSelect: 1,
          maxSelect: 2,
          options: [{ label: 'Regular', priceDelta: { amount: 0 } }],
        },
      ],
    });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
    expect(eventBus.publishedEvents).toHaveLength(0);
    expect(eventBus.publishedEvents).toHaveLength(0);
  });

  it('fails with ValidationError when a required group has no available options', async () => {
    const { menuItem } = await seed();

    const result = await useCase.execute({
      itemId: menuItem.id.toString(),
      actorId: 'owner-1',
      groups: [
        {
          label: 'Spice Level',
          selectionType: VARIANT_SELECTION_TYPE.SINGLE,
          required: true,
          minSelect: 1,
          maxSelect: 1,
          options: [{ label: 'Hot', priceDelta: { amount: 0 }, isAvailable: false }],
        },
      ],
    });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
    expect(eventBus.publishedEvents).toHaveLength(0);
    expect(eventBus.publishedEvents).toHaveLength(0);
  });
});
