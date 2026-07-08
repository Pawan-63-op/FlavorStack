import { ListCustomerOrders } from '../../../../application/fulfillment/use-cases/ListCustomerOrders';
import {
  IFulfillmentProjectionRepository,
  CustomerOrderSummaryView,
} from '../../../../domain/fulfillment/repositories/IFulfillmentProjectionRepository';

function makeRepo(): jest.Mocked<IFulfillmentProjectionRepository> {
  return {
    upsertCustomerTracking: jest.fn().mockResolvedValue(undefined),
    findCustomerTracking: jest.fn().mockResolvedValue(null),
    findByCustomer: jest.fn().mockResolvedValue([]),
    upsertRestaurantView: jest.fn().mockResolvedValue(undefined),
    removeRestaurantView: jest.fn().mockResolvedValue(undefined),
    findRestaurantQueue: jest.fn().mockResolvedValue([]),
    upsertRiderQueueItem: jest.fn().mockResolvedValue(undefined),
    removeRiderQueueItem: jest.fn().mockResolvedValue(undefined),
    removeAllRiderQueueItemsForFulfillment: jest.fn().mockResolvedValue(undefined),
    findRiderQueue: jest.fn().mockResolvedValue([]),
    findRiderCompletedDeliveries: jest.fn().mockResolvedValue([]),
    upsertAdminView: jest.fn().mockResolvedValue(undefined),
    patchAdminView: jest.fn().mockResolvedValue(undefined),
    findAdminDashboard: jest.fn().mockResolvedValue([]),
    aggregateAnalytics: jest.fn(),
  };
}

const PLACED = new Date('2026-06-20T10:00:00.000Z');
const UPDATED = new Date('2026-06-20T10:30:00.000Z');

const VIEW: CustomerOrderSummaryView = {
  fulfillmentId: 'f-1',
  orderRequestId: 'or-1',
  restaurantId: 'rest-1',
  fulfillmentStatus: 'PREPARING',
  deliveryStatus: 'UNASSIGNED',
  total: { amount: 25000, currency: 'INR' },
  placedAt: PLACED,
  updatedAt: UPDATED,
};

describe('ListCustomerOrders', () => {
  it('queries the projection scoped to the dto customerId and forwards paging', async () => {
    const repo = makeRepo();
    const uc = new ListCustomerOrders(repo);

    await uc.execute({ customerId: 'cust-1', limit: 10, offset: 5 });

    expect(repo.findByCustomer).toHaveBeenCalledWith('cust-1', { limit: 10, offset: 5 });
  });

  it('maps each projection view to an ISO-dated response row', async () => {
    const repo = makeRepo();
    repo.findByCustomer.mockResolvedValue([VIEW]);
    const uc = new ListCustomerOrders(repo);

    const result = await uc.execute({ customerId: 'cust-1' });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toEqual([
      {
        fulfillmentId: 'f-1',
        orderRequestId: 'or-1',
        restaurantId: 'rest-1',
        fulfillmentStatus: 'PREPARING',
        deliveryStatus: 'UNASSIGNED',
        total: { amount: 25000, currency: 'INR' },
        placedAt: PLACED.toISOString(),
        updatedAt: UPDATED.toISOString(),
      },
    ]);
  });

  it('returns an empty list when the customer has no orders', async () => {
    const repo = makeRepo();
    const uc = new ListCustomerOrders(repo);

    const result = await uc.execute({ customerId: 'cust-nobody' });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toEqual([]);
  });
});
