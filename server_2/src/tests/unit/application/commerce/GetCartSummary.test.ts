import { GetCartSummary } from '../../../../application/commerce/use-cases/GetCartSummary';
import { InMemoryCartRepository } from '../../../mocks/commerce.mocks';
import { Cart } from '../../../../domain/commerce/entities/Cart';
import { LineItemSelection } from '../../../../domain/commerce/value-objects/LineItemSelection';
import { Money } from '../../../../domain/shared/Money';

describe('GetCartSummary use-case', () => {
  let cartRepo: InMemoryCartRepository;

  beforeEach(() => {
    cartRepo = new InMemoryCartRepository();
  });

  it('returns item count (sum of quantities) and subtotal for a non-empty cart', async () => {
    const cart = Cart.create('customer-1').getValue();
    cart.addItem(
      'restaurant-1',
      LineItemSelection.create({ menuItemId: 'menu-1', quantity: 2 }).getValue(),
      Money.create(15000).getValue()
    );
    cart.addItem(
      'restaurant-1',
      LineItemSelection.create({ menuItemId: 'menu-2', quantity: 3 }).getValue(),
      Money.create(5000).getValue()
    );
    await cartRepo.save(cart);

    const useCase = new GetCartSummary(cartRepo);
    const result = await useCase.execute({ customerId: 'customer-1' });

    expect(result.isSuccess).toBe(true);
    const summary = result.getValue();
    expect(summary.cartId).toBe(cart.id.toString());
    expect(summary.itemCount).toBe(5);
    expect(summary.total).toEqual({ amount: 45000, currency: 'INR' });
    expect(summary.currency).toBe('INR');
  });

  it('returns an empty summary (no 404) when the customer has no active cart', async () => {
    const useCase = new GetCartSummary(cartRepo);
    const result = await useCase.execute({ customerId: 'no-cart-customer' });

    expect(result.isSuccess).toBe(true);
    const summary = result.getValue();
    expect(summary.cartId).toBeNull();
    expect(summary.itemCount).toBe(0);
    expect(summary.total).toBeNull();
    expect(summary.currency).toBeNull();
  });

  it('returns an empty summary for an existing but empty cart', async () => {
    const cart = Cart.create('customer-1').getValue();
    await cartRepo.save(cart);

    const useCase = new GetCartSummary(cartRepo);
    const result = await useCase.execute({ customerId: 'customer-1' });

    expect(result.isSuccess).toBe(true);
    const summary = result.getValue();
    expect(summary.cartId).toBe(cart.id.toString());
    expect(summary.itemCount).toBe(0);
    expect(summary.total).toBeNull();
    expect(summary.currency).toBeNull();
  });
});
