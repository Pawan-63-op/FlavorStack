import { SocketTrackingBroadcaster } from '../../../../infrastructure/realtime/SocketTrackingBroadcaster';
import { trackingRoom, TRACKING_LOCATION_EVENT, TRACKING_STATUS_EVENT } from '../../../../infrastructure/realtime/rooms';
import type { Namespace } from 'socket.io';

function makeNamespace(): { ns: Namespace; emit: jest.Mock; to: jest.Mock } {
  const emit = jest.fn();
  const to = jest.fn().mockReturnValue({ emit });
  const ns = { to } as unknown as Namespace;
  return { ns, emit, to };
}

describe('SocketTrackingBroadcaster', () => {
  it('is a no-op before a namespace is attached', () => {
    const b = new SocketTrackingBroadcaster();
    expect(() =>
      b.broadcastLocation('ful-1', { fulfillmentId: 'ful-1', riderId: 'r', lat: 0, lng: 0, recordedAt: 'now' })
    ).not.toThrow();
  });

  it('emits tracking:location to the fulfillment room after attach', () => {
    const { ns, emit, to } = makeNamespace();
    const b = new SocketTrackingBroadcaster();
    b.attach(ns);

    const payload = { fulfillmentId: 'ful-1', riderId: 'r', lat: 1, lng: 2, recordedAt: 'now' };
    b.broadcastLocation('ful-1', payload);

    expect(to).toHaveBeenCalledWith(trackingRoom('ful-1'));
    expect(emit).toHaveBeenCalledWith(TRACKING_LOCATION_EVENT, payload);
  });

  it('emits tracking:status to the fulfillment room after attach', () => {
    const { ns, emit, to } = makeNamespace();
    const b = new SocketTrackingBroadcaster();
    b.attach(ns);

    const payload = { fulfillmentId: 'ful-2', status: 'OutForDelivery', at: 'now', riderId: 'r' };
    b.broadcastStatus('ful-2', payload);

    expect(to).toHaveBeenCalledWith(trackingRoom('ful-2'));
    expect(emit).toHaveBeenCalledWith(TRACKING_STATUS_EVENT, payload);
  });
});
