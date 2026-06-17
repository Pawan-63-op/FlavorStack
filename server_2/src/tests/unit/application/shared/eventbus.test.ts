import { InMemoryEventBus } from '../../../../application/shared/events/InMemoryEventBus';
import { DomainEvent } from '../../../../domain/shared/DomainEvent';

function makeEvent(name: string, id = 'agg-1'): DomainEvent {
  return {
    eventId: `evt-${Math.random()}`,
    occurredOn: new Date(),
    eventName: name,
    aggregateId: id,
  };
}

describe('InMemoryEventBus', () => {
  it('calls subscribed handler with the published event', async () => {
    const bus = new InMemoryEventBus();
    const received: DomainEvent[] = [];
    bus.subscribe('UserRegistered', async (e) => { received.push(e); });

    const event = makeEvent('UserRegistered');
    await bus.publish(event);

    expect(received).toHaveLength(1);
    expect(received[0]).toBe(event);
  });

  it('publishAll dispatches all events to subscribers', async () => {
    const bus = new InMemoryEventBus();
    const received: DomainEvent[] = [];
    bus.subscribe('OrderPlaced', async (e) => { received.push(e); });

    const events = [makeEvent('OrderPlaced'), makeEvent('OrderPlaced')];
    await bus.publishAll(events);

    expect(received).toHaveLength(2);
  });

  it('does not throw when one handler fails; other handlers still run', async () => {
    const bus = new InMemoryEventBus();
    const calls: string[] = [];

    bus.subscribe('PaymentFailed', async () => { throw new Error('handler boom'); });
    bus.subscribe('PaymentFailed', async () => { calls.push('second'); });

    const event = makeEvent('PaymentFailed');
    await expect(bus.publishAll([event])).resolves.toBeUndefined();
    expect(calls).toContain('second');
  });

  it('publish with no subscribers does nothing', async () => {
    const bus = new InMemoryEventBus();
    const event = makeEvent('UnknownEvent');
    await expect(bus.publish(event)).resolves.toBeUndefined();
  });
});
