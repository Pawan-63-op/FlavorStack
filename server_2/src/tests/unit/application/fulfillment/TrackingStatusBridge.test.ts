import { TrackingStatusBridge } from '../../../../application/fulfillment/event-handlers/TrackingStatusBridge';
import { ITrackingBroadcaster } from '../../../../application/fulfillment/ports/ITrackingBroadcaster';
import { DomainEvent } from '../../../../domain/shared/DomainEvent';

function makeBroadcaster(): jest.Mocked<ITrackingBroadcaster> {
  return { broadcastLocation: jest.fn(), broadcastStatus: jest.fn() } as jest.Mocked<ITrackingBroadcaster>;
}

describe('TrackingStatusBridge', () => {
  it('broadcasts tracking:status keyed by aggregateId with the canonical status (not the event name)', async () => {
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
      status: 'OUT_FOR_DELIVERY',
      at: occurredOn.toISOString(),
      riderId: 'rider-9',
    });
  });

  it('maps each customer-visible event to the status string the tracking read model uses', async () => {
    const cases: ReadonlyArray<[string, string]> = [
      ['FulfillmentCreated', 'CREATED'],
      ['PreparationStarted', 'PREPARING'],
      ['ReadyForPickup', 'READY_FOR_PICKUP'],
      ['RiderAssigned', 'ASSIGNED'],
      ['PickupConfirmed', 'PICKED_UP'],
      ['OutForDelivery', 'OUT_FOR_DELIVERY'],
      ['DeliveryCompleted', 'DELIVERED'],
      ['FulfillmentCancelled', 'CANCELLED'],
      ['DeliveryFailed', 'FAILED'],
      ['RiderReassigned', 'REASSIGNED'],
    ];

    for (const [eventName, expectedStatus] of cases) {
      const bus = makeBroadcaster();
      const bridge = new TrackingStatusBridge(bus);
      await bridge.handle({
        eventId: 'e',
        occurredOn: new Date(),
        eventName,
        aggregateId: 'ful-x',
      } as DomainEvent);

      expect(bus.broadcastStatus.mock.calls[0][1].status).toBe(expectedStatus);
    }
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
