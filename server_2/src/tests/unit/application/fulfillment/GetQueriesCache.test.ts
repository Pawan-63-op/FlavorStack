import { GetLiveTracking } from '../../../../application/fulfillment/use-cases/GetLiveTracking';
import { GetAdminDashboard } from '../../../../application/fulfillment/use-cases/GetAdminDashboard';
import { ICustomerTrackingRepository } from '../../../../domain/fulfillment/repositories/ICustomerTrackingRepository';
import { IFulfillmentReadCache } from '../../../../domain/fulfillment/services/IFulfillmentCache';
import { makeQueryRepo } from '../../../mocks/fulfillment.mocks';

function makeRepo(): jest.Mocked<ICustomerTrackingRepository> {
  return {
    upsertCustomerTracking: jest.fn().mockResolvedValue(undefined),
    findCustomerTracking: jest.fn().mockResolvedValue(null),
    findByCustomer: jest.fn().mockResolvedValue([]),
  };
}

function makePassThroughCache(): jest.Mocked<IFulfillmentReadCache> {
  return {
    rememberTracking: jest.fn((_id: string, loader: () => Promise<unknown>) => loader()),
    rememberDashboard: jest.fn((_disc: string, loader: () => Promise<unknown>) => loader()),
  } as unknown as jest.Mocked<IFulfillmentReadCache>;
}

const TRACKING_VIEW = {
  fulfillmentId: 'f-1',
  orderRequestId: 'or-1',
  customerId: 'cust-1',
  restaurantId: 'rest-1',
  currentStatus: 'PREPARING',
  deliveryStatus: 'UNASSIGNED',
  riderId: null,
  timeline: [],
  deliveryAddress: { street: 's', city: 'c', state: 'st', pinCode: '1', coordinates: { lat: 0, lng: 0 } },
  total: { amount: 100, currency: 'INR' },
  cancellation: null,
  failureReason: null,
  updatedAt: new Date(),
};

describe('GetLiveTracking caching', () => {
  it('routes the read through the cache keyed by fulfillmentId', async () => {
    const repo = makeRepo();
    repo.findCustomerTracking.mockResolvedValue(TRACKING_VIEW);
    const cache = makePassThroughCache();
    const uc = new GetLiveTracking(repo, cache);

    const result = await uc.execute({ fulfillmentId: 'f-1', customerId: 'cust-1' });

    expect(result.isSuccess).toBe(true);
    expect(cache.rememberTracking).toHaveBeenCalledWith('f-1', expect.any(Function));
  });

  it('serves a served-from-cache value without hitting the projection repo', async () => {
    const repo = makeRepo();
    const cache = makePassThroughCache();
    cache.rememberTracking.mockResolvedValue(TRACKING_VIEW);
    const uc = new GetLiveTracking(repo, cache);

    const result = await uc.execute({ fulfillmentId: 'f-1' });

    expect(result.isSuccess).toBe(true);
    expect(repo.findCustomerTracking).not.toHaveBeenCalled();
  });

  it('still enforces ownership on a cached view', async () => {
    const repo = makeRepo();
    const cache = makePassThroughCache();
    cache.rememberTracking.mockResolvedValue(TRACKING_VIEW); // belongs to cust-1
    const uc = new GetLiveTracking(repo, cache);

    const result = await uc.execute({ fulfillmentId: 'f-1', customerId: 'intruder' });

    expect(result.isFailure).toBe(true);
  });

  it('falls back to a direct projection read when no cache is wired', async () => {
    const repo = makeRepo();
    repo.findCustomerTracking.mockResolvedValue(TRACKING_VIEW);
    const uc = new GetLiveTracking(repo);

    const result = await uc.execute({ fulfillmentId: 'f-1' });

    expect(result.isSuccess).toBe(true);
    expect(repo.findCustomerTracking).toHaveBeenCalledWith('f-1');
  });
});

describe('GetAdminDashboard caching', () => {
  it('routes the read through the cache with a deterministic filter discriminator', async () => {
    const repo = makeQueryRepo();
    const cache = makePassThroughCache();
    const uc = new GetAdminDashboard(repo, cache);

    await uc.execute({ status: 'PREPARING', slaBreached: true, restaurantId: 'rest-1', limit: 20, offset: 0 });

    expect(cache.rememberDashboard).toHaveBeenCalledWith(
      'status=PREPARING|sla=true|rest=rest-1|limit=20|offset=0',
      expect.any(Function)
    );
  });

  it('falls back to a direct read when no cache is wired', async () => {
    const repo = makeQueryRepo();
    const uc = new GetAdminDashboard(repo);

    await uc.execute({ status: 'PREPARING' });

    expect(repo.findAdminDashboard).toHaveBeenCalledTimes(1);
  });
});
