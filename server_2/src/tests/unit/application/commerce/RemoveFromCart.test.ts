import { RemoveFromCart } from '../../../../application/commerce/use-cases/RemoveFromCart';
import { InMemoryCartRepository } from '../../../mocks/commerce.mocks';
import { InMemoryUnitOfWork } from '../../../mocks/identity.mocks';
import { Cart } from '../../../../domain/commerce/entities/Cart';
import { LineItemSelection } from '../../../../domain/commerce/value-objects/LineItemSelection';
import { Money } from '../../../../domain/shared/Money';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';

describe('RemoveFromCart use-case', () => {
  let cartRepo: InMemoryCartRepository;
  let unitOfWork: InMemoryUnitOfWork;
  let useCase: RemoveFromCart;

  beforeEach(() => {
    cartRepo = new InMemoryCartRepository();
    unitOfWork = new InMemoryUnitOfWork();
    useCase = new RemoveFromCart(cartRepo, unitOfWork);
  });

  async function seedCart(): Promise<{ cart: Cart; cartItemId: string }> {
    const cart = Cart.create('customer-1').getValue();
    const selection = LineItemSelection.create({ menuItemId: 'menu-1', quantity: 2 }).getValue();
    cart.addItem('restaurant-1', selection, Money.create(15000).getValue());
    await cartRepo.save(cart);
    return { cart, cartItemId: cart.items[0].id.toString() };
  }

  it('removes a line item and resets restaurant/currency when the cart becomes empty', async () => {
    const { cartItemId } = await seedCart();

    const result = await useCase.execute({ customerId: 'customer-1', cartItemId });

    expect(result.isSuccess).toBe(true);
    const view = result.getValue();
    expect(view.items).toHaveLength(0);
    expect(view.restaurantId).toBeNull();
    expect(view.currency).toBeNull();
    expect(unitOfWork.committed).toBe(true);
  });

  it('fails with NotFoundError for an unknown cart item', async () => {
    await seedCart();

    const result = await useCase.execute({ customerId: 'customer-1', cartItemId: 'does-not-exist' });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
  });

  it('fails with NotFoundError when the customer has no cart', async () => {
    const result = await useCase.execute({ customerId: 'no-cart-customer', cartItemId: 'whatever' });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
  });
});
