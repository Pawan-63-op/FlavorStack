import { ClearCart } from '../../../../application/commerce/use-cases/ClearCart';
import { InMemoryCartRepository } from '../../../mocks/commerce.mocks';
import { InMemoryUnitOfWork } from '../../../mocks/identity.mocks';
import { createEventBusSpy, EventBusSpy } from '../../../mocks/shared.mocks';
import { Cart } from '../../../../domain/commerce/entities/Cart';
import { LineItemSelection } from '../../../../domain/commerce/value-objects/LineItemSelection';
import { Money } from '../../../../domain/shared/Money';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';

describe('ClearCart use-case', () => {
  let cartRepo: InMemoryCartRepository;
  let unitOfWork: InMemoryUnitOfWork;
  let eventBus: EventBusSpy;
  let useCase: ClearCart;

  beforeEach(() => {
    cartRepo = new InMemoryCartRepository();
    unitOfWork = new InMemoryUnitOfWork();
    eventBus = createEventBusSpy();
    useCase = new ClearCart(cartRepo, unitOfWork, eventBus);
  });

  it('clears all items, restaurant and currency from the cart', async () => {
    const cart = Cart.create('customer-1').getValue();
    const selection = LineItemSelection.create({ menuItemId: 'menu-1', quantity: 2 }).getValue();
    cart.addItem('restaurant-1', selection, Money.create(15000).getValue());
    cart.pullDomainEvents();
    await cartRepo.save(cart);

    const result = await useCase.execute({ customerId: 'customer-1' });

    expect(result.isSuccess).toBe(true);
    const view = result.getValue();
    expect(view.items).toEqual([]);
    expect(view.restaurantId).toBeNull();
    expect(view.currency).toBeNull();
    expect(unitOfWork.committed).toBe(true);
    expect(eventBus.publishedEvents).toHaveLength(1);
    expect(eventBus.publishedEvents[0].eventName).toBe('CartCleared');
  });

  it('fails with NotFoundError when the customer has no cart', async () => {
    const result = await useCase.execute({ customerId: 'no-cart-customer' });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
  });
});
