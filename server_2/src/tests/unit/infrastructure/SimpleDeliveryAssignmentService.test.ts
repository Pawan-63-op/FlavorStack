import { SimpleDeliveryAssignmentService } from '../../../infrastructure/services/SimpleDeliveryAssignmentService';

describe('SimpleDeliveryAssignmentService', () => {
  it('returns the first available rider for the restaurant', async () => {
    const service = new SimpleDeliveryAssignmentService(async () => ['rider-1', 'rider-2']);

    const next = await service.pickNextRider({ restaurantId: 'rest-1', excludeRiderIds: [] });

    expect(next).toBe('rider-1');
  });

  it('skips excluded riders (already tried) and returns the next candidate', async () => {
    const service = new SimpleDeliveryAssignmentService(async () => ['rider-1', 'rider-2', 'rider-3']);

    const next = await service.pickNextRider({
      restaurantId: 'rest-1',
      excludeRiderIds: ['rider-1', 'rider-2'],
    });

    expect(next).toBe('rider-3');
  });

  it('returns null when no candidates are available', async () => {
    const service = new SimpleDeliveryAssignmentService(async () => []);

    const next = await service.pickNextRider({ restaurantId: 'rest-1', excludeRiderIds: [] });

    expect(next).toBeNull();
  });

  it('returns null when every candidate is excluded', async () => {
    const service = new SimpleDeliveryAssignmentService(async () => ['rider-1']);

    const next = await service.pickNextRider({
      restaurantId: 'rest-1',
      excludeRiderIds: ['rider-1'],
    });

    expect(next).toBeNull();
  });

  it('passes the restaurantId through to the provider', async () => {
    const provider = jest.fn(async () => ['rider-1']);
    const service = new SimpleDeliveryAssignmentService(provider);

    await service.pickNextRider({ restaurantId: 'rest-42', excludeRiderIds: [] });

    expect(provider).toHaveBeenCalledWith('rest-42');
  });

  describe('isRiderAssignable', () => {
    it('accepts a rider the provider currently lists for that restaurant', async () => {
      const service = new SimpleDeliveryAssignmentService(async () => ['rider-1', 'rider-2']);

      expect(await service.isRiderAssignable('rider-2', 'rest-1')).toBe(true);
    });

    it('rejects an id the provider does not list — an offline rider, a busy one, or a non-rider', async () => {
      const service = new SimpleDeliveryAssignmentService(async () => ['rider-1']);

      expect(await service.isRiderAssignable('cust-9', 'rest-1')).toBe(false);
    });
  });
});
