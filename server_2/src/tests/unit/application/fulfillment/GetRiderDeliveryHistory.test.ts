import { GetRiderDeliveryHistory } from '../../../../application/fulfillment/use-cases/GetRiderDeliveryHistory';
import { RiderDeliveryHistoryView } from '../../../../domain/fulfillment/repositories/IFulfillmentQueryRepository';
import { makeQueryRepo as makeRepo } from '../../../mocks/fulfillment.mocks';

const DELIVERED_AT = new Date('2026-06-27T18:47:34.090Z');

const VIEW: RiderDeliveryHistoryView = {
  fulfillmentId: 'f-1',
  restaurantId: 'rest-1',
  status: 'DELIVERED',
  total: { amount: 36539, currency: 'INR' },
  deliveredAt: DELIVERED_AT,
};

describe('GetRiderDeliveryHistory', () => {
  it('queries the aggregate scoped to the dto riderId and forwards paging', async () => {
    const repo = makeRepo();
    const uc = new GetRiderDeliveryHistory(repo);

    await uc.execute({ riderId: 'rider-1', limit: 10, offset: 5 });

    expect(repo.findRiderCompletedDeliveries).toHaveBeenCalledWith('rider-1', {
      limit: 10,
      offset: 5,
    });
  });

  it('computes per-delivery earnings and the summary, mapping deliveredAt to ISO', async () => {
    const repo = makeRepo();
    repo.findRiderCompletedDeliveries.mockResolvedValue([VIEW, { ...VIEW, fulfillmentId: 'f-2' }]);
    const uc = new GetRiderDeliveryHistory(repo);

    const result = await uc.execute({ riderId: 'rider-1' });

    expect(result.isSuccess).toBe(true);
    const body = result.getValue();
    expect(body.deliveries[0]).toEqual({
      fulfillmentId: 'f-1',
      restaurantId: 'rest-1',
      status: 'DELIVERED',
      total: { amount: 36539, currency: 'INR' },
      earning: { amount: 6154, currency: 'INR' },
      deliveredAt: DELIVERED_AT.toISOString(),
    });
    expect(body.summary).toEqual({
      totalDeliveries: 2,
      totalEarnings: { amount: 12308, currency: 'INR' },
    });
  });

  it('returns an empty history with a zero INR summary when the rider has no deliveries', async () => {
    const repo = makeRepo();
    const uc = new GetRiderDeliveryHistory(repo);

    const body = (await uc.execute({ riderId: 'rider-1' })).getValue();

    expect(body.deliveries).toEqual([]);
    expect(body.summary).toEqual({
      totalDeliveries: 0,
      totalEarnings: { amount: 0, currency: 'INR' },
    });
  });
});
