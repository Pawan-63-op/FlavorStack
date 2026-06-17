import { CreateCart } from '../../../../application/commerce/use-cases/CreateCart';
import { InMemoryCartRepository } from '../../../mocks/commerce.mocks';
import { InMemoryUnitOfWork } from '../../../mocks/identity.mocks';

describe('CreateCart use-case', () => {
  let cartRepo: InMemoryCartRepository;
  let unitOfWork: InMemoryUnitOfWork;
  let useCase: CreateCart;

  beforeEach(() => {
    cartRepo = new InMemoryCartRepository();
    unitOfWork = new InMemoryUnitOfWork();
    useCase = new CreateCart(cartRepo, unitOfWork);
  });

  it('creates an empty cart for a customer with no active cart', async () => {
    const result = await useCase.execute({ customerId: 'customer-1' });

    expect(result.isSuccess).toBe(true);
    const view = result.getValue();
    expect(view.customerId).toBe('customer-1');
    expect(view.restaurantId).toBeNull();
    expect(view.items).toEqual([]);
    expect(view.version).toBe(0);

    const saved = await cartRepo.findByCustomerId('customer-1');
    expect(saved).not.toBeNull();
  });

  it('is idempotent — returns the existing cart without creating a duplicate', async () => {
    const first = await useCase.execute({ customerId: 'customer-1' });
    const second = await useCase.execute({ customerId: 'customer-1' });

    expect(second.isSuccess).toBe(true);
    expect(second.getValue().id).toBe(first.getValue().id);
  });
});
