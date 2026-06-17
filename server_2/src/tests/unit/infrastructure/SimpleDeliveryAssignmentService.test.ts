import { SimpleDeliveryAssignmentService } from '../../../infrastructure/services/SimpleDeliveryAssignmentService';
import { DeliveryAddress } from '../../../domain/fulfillment/value-objects/DeliveryAddress';
import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';

function address(): DeliveryAddress {
  return DeliveryAddress.create({
    street: '12 MG Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    pinCode: '560001',
    coordinates: GeoPoint.create(12.97, 77.59).getValue(),
  }).getValue();
}

describe('SimpleDeliveryAssignmentService', () => {
  it('returns the first available rider for the restaurant', async () => {
    const service = new SimpleDeliveryAssignmentService(async () => ['rider-1', 'rider-2']);

    const next = await service.pickNextRider({ restaurantId: 'rest-1', address: address(), excludeRiderIds: [] });

    expect(next).toBe('rider-1');
  });

  it('skips excluded riders (already tried) and returns the next candidate', async () => {
    const service = new SimpleDeliveryAssignmentService(async () => ['rider-1', 'rider-2', 'rider-3']);

    const next = await service.pickNextRider({
      restaurantId: 'rest-1',
      address: address(),
      excludeRiderIds: ['rider-1', 'rider-2'],
    });

    expect(next).toBe('rider-3');
  });

  it('returns null when no candidates are available', async () => {
    const service = new SimpleDeliveryAssignmentService(async () => []);

    const next = await service.pickNextRider({ restaurantId: 'rest-1', address: address(), excludeRiderIds: [] });

    expect(next).toBeNull();
  });

  it('returns null when every candidate is excluded', async () => {
    const service = new SimpleDeliveryAssignmentService(async () => ['rider-1']);

    const next = await service.pickNextRider({
      restaurantId: 'rest-1',
      address: address(),
      excludeRiderIds: ['rider-1'],
    });

    expect(next).toBeNull();
  });

  it('passes the restaurantId through to the provider', async () => {
    const provider = jest.fn(async () => ['rider-1']);
    const service = new SimpleDeliveryAssignmentService(provider);

    await service.pickNextRider({ restaurantId: 'rest-42', address: address(), excludeRiderIds: [] });

    expect(provider).toHaveBeenCalledWith('rest-42');
  });
});
