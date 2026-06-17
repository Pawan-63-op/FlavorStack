import { UpdateCartItem } from '../../../../application/commerce/use-cases/UpdateCartItem';
import { InMemoryCartRepository } from '../../../mocks/commerce.mocks';
import { InMemoryUnitOfWork } from '../../../mocks/identity.mocks';
import { Cart } from '../../../../domain/commerce/entities/Cart';
import { LineItemSelection } from '../../../../domain/commerce/value-objects/LineItemSelection';
import { Money } from '../../../../domain/shared/Money';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';

describe('UpdateCartItem use-case', () => {
  let cartRepo: InMemoryCartRepository;
  let unitOfWork: InMemoryUnitOfWork;
  let useCase: UpdateCartItem;

  beforeEach(() => {
    cartRepo = new InMemoryCartRepository();
    unitOfWork = new InMemoryUnitOfWork();
    useCase = new UpdateCartItem(cartRepo, unitOfWork);
  });

  async function seedCart(): Promise<string> {
    const cart = Cart.create('customer-1').getValue();
    const selection = LineItemSelection.create({ menuItemId: 'menu-1', quantity: 2 }).getValue();
    cart.addItem('restaurant-1', selection, Money.create(15000).getValue());
    await cartRepo.save(cart);
    return cart.items[0].id.toString();
  }

  it('updates the quantity of a line item', async () => {
    const cartItemId = await seedCart();

    const result = await useCase.execute({ customerId: 'customer-1', cartItemId, quantity: 5 });

    expect(result.isSuccess).toBe(true);
    const view = result.getValue();
    expect(view.items[0].quantity).toBe(5);
    expect(unitOfWork.committed).toBe(true);
  });

  it('removes the line item when quantity is 0', async () => {
    const cartItemId = await seedCart();

    const result = await useCase.execute({ customerId: 'customer-1', cartItemId, quantity: 0 });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().items).toHaveLength(0);
  });

  it('fails on a quantity above the allowed maximum', async () => {
    const cartItemId = await seedCart();

    const result = await useCase.execute({ customerId: 'customer-1', cartItemId, quantity: 1000 });

    expect(result.isFailure).toBe(true);
  });

  it('fails with NotFoundError when the customer has no cart', async () => {
    const result = await useCase.execute({ customerId: 'no-cart-customer', cartItemId: 'whatever', quantity: 1 });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
  });
});
