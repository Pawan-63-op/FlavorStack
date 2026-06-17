import { GetOrderRequest } from '../../../../application/commerce/use-cases/GetOrderRequest';
import { IOrderRequestRepository } from '../../../../domain/commerce/repositories/IOrderRequestRepository';
import { OrderRequest } from '../../../../domain/commerce/entities/OrderRequest';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';
import { buildOrderRequest } from '../../../integration/commerce/commerce-fixtures';

function fakeRepo(order: OrderRequest | null): IOrderRequestRepository {
  return {
    findById: jest.fn().mockResolvedValue(order),
    findByIdempotencyKey: jest.fn(),
    save: jest.fn(),
  };
}

describe('GetOrderRequest use-case', () => {
  it('returns the OrderRequest summary when the requester owns it', async () => {
    const order = buildOrderRequest('customer-1');
    const repo = fakeRepo(order);
    const useCase = new GetOrderRequest(repo);

    const result = await useCase.execute({
      orderRequestId: order.id.toString(),
      customerId: 'customer-1',
    });

    expect(result.isSuccess).toBe(true);
    const summary = result.getValue();
    expect(summary.orderRequestId).toBe(order.id.toString());
    expect(summary.customerId).toBe('customer-1');
    expect(repo.findById).toHaveBeenCalledWith(order.id.toString());
  });

  it('fails with NotFoundError when no OrderRequest exists for the id', async () => {
    const repo = fakeRepo(null);
    const useCase = new GetOrderRequest(repo);

    const result = await useCase.execute({
      orderRequestId: 'missing-id',
      customerId: 'customer-1',
    });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
  });

  it('fails with ForbiddenError when the requester does not own the OrderRequest', async () => {
    const order = buildOrderRequest('owner-customer');
    const repo = fakeRepo(order);
    const useCase = new GetOrderRequest(repo);

    const result = await useCase.execute({
      orderRequestId: order.id.toString(),
      customerId: 'someone-else',
    });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ForbiddenError);
  });
});
