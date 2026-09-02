import { AddToCart } from '../../../../application/commerce/use-cases/AddToCart';
import { InMemoryCartRepository } from '../../../mocks/commerce.mocks';
import { InMemoryUnitOfWork } from '../../../mocks/identity.mocks';
import { createEventBusSpy, EventBusSpy } from '../../../mocks/shared.mocks';
import { AddToCartDto } from '../../../../application/commerce/dtos/AddToCartDto';

function dto(overrides: Partial<AddToCartDto> = {}): AddToCartDto {
  return {
    customerId: 'customer-1',
    restaurantId: 'restaurant-1',
    menuItemId: 'menu-1',
    selectedOptionIds: [],
    quantity: 2,
    unitPrice: { amount: 15000, currency: 'INR' },
    ...overrides,
  };
}

describe('AddToCart use-case', () => {
  let cartRepo: InMemoryCartRepository;
  let unitOfWork: InMemoryUnitOfWork;
  let eventBus: EventBusSpy;
  let useCase: AddToCart;

  beforeEach(() => {
    cartRepo = new InMemoryCartRepository();
    unitOfWork = new InMemoryUnitOfWork();
    eventBus = createEventBusSpy();
    useCase = new AddToCart(cartRepo, unitOfWork, eventBus);
  });

  it('creates a cart for a new customer and adds the first item', async () => {
    const result = await useCase.execute(dto());

    expect(result.isSuccess).toBe(true);
    const view = result.getValue();
    expect(view.customerId).toBe('customer-1');
    expect(view.restaurantId).toBe('restaurant-1');
    expect(view.currency).toBe('INR');
    expect(view.items).toHaveLength(1);
    expect(view.items[0].quantity).toBe(2);

    const saved = await cartRepo.findByCustomerId('customer-1');
    expect(saved).not.toBeNull();
    expect(unitOfWork.committed).toBe(true);
    // Phase 6: cart mutations raise no domain event — nothing subscribed to them.
    expect(eventBus.publishedEvents).toHaveLength(0);
  });

  it('merges an identical line into the existing cart', async () => {
    await useCase.execute(dto({ quantity: 1 }));
    const result = await useCase.execute(dto({ quantity: 3 }));

    expect(result.isSuccess).toBe(true);
    const view = result.getValue();
    expect(view.items).toHaveLength(1);
    expect(view.items[0].quantity).toBe(4);
  });

  it('fails when adding an item from a different restaurant', async () => {
    await useCase.execute(dto());

    const result = await useCase.execute(dto({ restaurantId: 'restaurant-2', menuItemId: 'menu-2' }));

    expect(result.isFailure).toBe(true);
  });

  it('fails on an invalid quantity', async () => {
    const result = await useCase.execute(dto({ quantity: 0 }));

    expect(result.isFailure).toBe(true);
  });

  it('fails on an invalid unit price', async () => {
    const result = await useCase.execute(dto({ unitPrice: { amount: -100, currency: 'INR' } }));

    expect(result.isFailure).toBe(true);
  });
});
