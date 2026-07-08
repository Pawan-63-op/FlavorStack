import { RecordRiderLocation } from '../../../../application/fulfillment/use-cases/RecordRiderLocation';
import { ILiveLocationStore } from '../../../../application/fulfillment/ports/ILiveLocationStore';
import { IDeliveryTrackingStore } from '../../../../application/fulfillment/ports/IDeliveryTrackingStore';
import { ITrackingBroadcaster } from '../../../../application/fulfillment/ports/ITrackingBroadcaster';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';
import { Fulfillment } from '../../../../domain/fulfillment/entities/Fulfillment';
import { buildReadyFulfillment, makeRepo } from './assignment-uc-fixtures';

const THROTTLE = 7;

/** A fulfillment with an ACCEPTED rider on an active (ASSIGNED) delivery leg. */
function buildAssignedFulfillment(riderId = 'rider-1'): Fulfillment {
  const f = buildReadyFulfillment();
  f.offerToRider(riderId, new Date(Date.now() + 60_000));
  f.acceptByRider(riderId);
  f.pullDomainEvents();
  return f;
}

function makeLiveStore(slot = true): jest.Mocked<ILiveLocationStore> {
  return {
    setLatest: jest.fn().mockResolvedValue(undefined),
    getLatest: jest.fn().mockResolvedValue(null),
    tryAcquirePersistSlot: jest.fn().mockResolvedValue(slot),
  } as jest.Mocked<ILiveLocationStore>;
}
function makeTrackingStore(): jest.Mocked<IDeliveryTrackingStore> {
  return { append: jest.fn().mockResolvedValue(undefined) } as jest.Mocked<IDeliveryTrackingStore>;
}
function makeBroadcaster(): jest.Mocked<ITrackingBroadcaster> {
  return {
    broadcastLocation: jest.fn(),
    broadcastStatus: jest.fn(),
  } as jest.Mocked<ITrackingBroadcaster>;
}

describe('RecordRiderLocation', () => {
  it('records latest, broadcasts, and persists when the throttle slot is open', async () => {
    const f = buildAssignedFulfillment('rider-1');
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const live = makeLiveStore(true);
    const track = makeTrackingStore();
    const bus = makeBroadcaster();
    const uc = new RecordRiderLocation(repo, live, track, bus, THROTTLE);

    const result = await uc.execute({ fulfillmentId: f.id.toString(), riderId: 'rider-1', lat: 12.97, lng: 77.59 });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().persisted).toBe(true);
    expect(live.setLatest).toHaveBeenCalledTimes(1);
    expect(bus.broadcastLocation).toHaveBeenCalledTimes(1);
    expect(bus.broadcastLocation.mock.calls[0][1]).toMatchObject({ riderId: 'rider-1', lat: 12.97, lng: 77.59 });
    expect(live.tryAcquirePersistSlot).toHaveBeenCalledWith(f.id.toString(), THROTTLE);
    expect(track.append).toHaveBeenCalledTimes(1);
    expect(repo.update).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('still caches + broadcasts but skips Mongo when the throttle slot is closed', async () => {
    const f = buildAssignedFulfillment('rider-1');
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const live = makeLiveStore(false);
    const track = makeTrackingStore();
    const bus = makeBroadcaster();
    const uc = new RecordRiderLocation(repo, live, track, bus, THROTTLE);

    const result = await uc.execute({ fulfillmentId: f.id.toString(), riderId: 'rider-1', lat: 1, lng: 2 });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().persisted).toBe(false);
    expect(live.setLatest).toHaveBeenCalledTimes(1);
    expect(bus.broadcastLocation).toHaveBeenCalledTimes(1);
    expect(track.append).not.toHaveBeenCalled();
  });

  it('rejects invalid coordinates with a ValidationError (no side effects)', async () => {
    const f = buildAssignedFulfillment('rider-1');
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const live = makeLiveStore();
    const track = makeTrackingStore();
    const bus = makeBroadcaster();
    const uc = new RecordRiderLocation(repo, live, track, bus, THROTTLE);

    const result = await uc.execute({ fulfillmentId: f.id.toString(), riderId: 'rider-1', lat: 999, lng: 0 });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
    expect(repo.findById).not.toHaveBeenCalled();
    expect(live.setLatest).not.toHaveBeenCalled();
    expect(bus.broadcastLocation).not.toHaveBeenCalled();
  });

  it('returns NotFoundError for an unknown fulfillment', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const live = makeLiveStore();
    const uc = new RecordRiderLocation(repo, live, makeTrackingStore(), makeBroadcaster(), THROTTLE);

    const result = await uc.execute({ fulfillmentId: 'nope', riderId: 'rider-1', lat: 0, lng: 0 });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
    expect(live.setLatest).not.toHaveBeenCalled();
  });

  it('forbids a rider who does not own the active assignment', async () => {
    const f = buildAssignedFulfillment('rider-1');
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const live = makeLiveStore();
    const track = makeTrackingStore();
    const uc = new RecordRiderLocation(repo, live, track, makeBroadcaster(), THROTTLE);

    const result = await uc.execute({ fulfillmentId: f.id.toString(), riderId: 'rider-2', lat: 0, lng: 0 });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ForbiddenError);
    expect(live.setLatest).not.toHaveBeenCalled();
    expect(track.append).not.toHaveBeenCalled();
  });

  it('forbids pings before the offer is accepted (only OFFERED)', async () => {
    const f = buildReadyFulfillment();
    f.offerToRider('rider-1', new Date(Date.now() + 60_000));
    f.pullDomainEvents();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const live = makeLiveStore();
    const uc = new RecordRiderLocation(repo, live, makeTrackingStore(), makeBroadcaster(), THROTTLE);

    const result = await uc.execute({ fulfillmentId: f.id.toString(), riderId: 'rider-1', lat: 0, lng: 0 });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ForbiddenError);
  });

  it('forbids pings once the delivery has completed (terminal)', async () => {
    const f = buildAssignedFulfillment('rider-1');
    f.confirmPickup('rider-1');
    f.startDelivery('rider-1');
    f.completeDelivery('rider-1');
    f.pullDomainEvents();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const live = makeLiveStore();
    const uc = new RecordRiderLocation(repo, live, makeTrackingStore(), makeBroadcaster(), THROTTLE);

    const result = await uc.execute({ fulfillmentId: f.id.toString(), riderId: 'rider-1', lat: 0, lng: 0 });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ForbiddenError);
    expect(live.setLatest).not.toHaveBeenCalled();
  });
});
