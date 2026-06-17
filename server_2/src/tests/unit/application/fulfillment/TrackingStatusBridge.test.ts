// Unit tests for TrackingStatusBridge (Phase 7) — re-broadcasts status events to the order room.
import { TrackingStatusBridge } from '../../../../application/fulfillment/event-handlers/TrackingStatusBridge';
import { ITrackingBroadcaster } from '../../../../application/fulfillment/ports/ITrackingBroadcaster';
import { DomainEvent } from '../../../../domain/shared/DomainEvent';

function makeBroadcaster(): jest.Mocked<ITrackingBroadcaster> {
  return { broadcastLocation: jest.fn(), broadcastStatus: jest.fn() } as jest.Mocked<ITrackingBroadcaster>;
}

describe('TrackingStatusBridge', () => {
  it('broadcasts tracking:status keyed by aggregateId with the event name as status', async () => {
    const bus = makeBroadcaster();
    const bridge = new TrackingStatusBridge(bus);
    const occurredOn = new Date('2026-06-16T10:00:00.000Z');
    const event = {
      eventId: 'e1',
      occurredOn,
      eventName: 'OutForDelivery',
      aggregateId: 'ful-1',
      riderId: 'rider-9',
    } as unknown as DomainEvent;

    await bridge.handle(event);

    expect(bus.broadcastStatus).toHaveBeenCalledTimes(1);
    expect(bus.broadcastStatus).toHaveBeenCalledWith('ful-1', {
      fulfillmentId: 'ful-1',
      status: 'OutForDelivery',
      at: occurredOn.toISOString(),
      riderId: 'rider-9',
    });
  });

  it('defaults riderId to null when the event carries none', async () => {
    const bus = makeBroadcaster();
    const bridge = new TrackingStatusBridge(bus);
    const event = {
      eventId: 'e2',
      occurredOn: new Date(),
      eventName: 'PreparationStarted',
      aggregateId: 'ful-2',
    } as DomainEvent;

    await bridge.handle(event);

    expect(bus.broadcastStatus.mock.calls[0][1].riderId).toBeNull();
  });
});
