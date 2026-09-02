import { OutboxDispatcher } from '../../../../application/shared/outbox/OutboxDispatcher';
import { DomainEvent } from '../../../../domain/shared/DomainEvent';
import { logger } from '../../../../infrastructure/observability/logger';

function event(eventName: string): DomainEvent {
  return { eventId: 'e-1', eventName, aggregateId: 'a-1', occurredOn: new Date() };
}

describe('OutboxDispatcher', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('routes an event to exactly the handler registered for its name', async () => {
    const routed = jest.fn().mockResolvedValue(undefined);
    const other = jest.fn().mockResolvedValue(undefined);
    const dispatcher = new OutboxDispatcher({ OrderRequested: routed, SomethingElse: other });

    await dispatcher.dispatch(event('OrderRequested'));

    expect(routed).toHaveBeenCalledTimes(1);
    expect(routed.mock.calls[0][0].eventName).toBe('OrderRequested');
    expect(other).not.toHaveBeenCalled();
  });

  it('propagates a handler rejection so the relay can retry the row', async () => {
    const dispatcher = new OutboxDispatcher({
      OrderRequested: async () => {
        throw new Error('handler blew up');
      },
    });

    await expect(dispatcher.dispatch(event('OrderRequested'))).rejects.toThrow('handler blew up');
  });

  it('resolves as a no-op for an unmapped event name — it was delivered in-process', async () => {
    const dispatcher = new OutboxDispatcher({});

    await expect(dispatcher.dispatch(event('UserRegistered'))).resolves.toBeUndefined();
  });

  it('logs the no-op once per event name, not once per row', async () => {
    const info = jest.spyOn(logger, 'info').mockImplementation(() => logger);
    const dispatcher = new OutboxDispatcher({});

    await dispatcher.dispatch(event('UserRegistered'));
    await dispatcher.dispatch(event('UserRegistered'));
    await dispatcher.dispatch(event('RestaurantCreated'));

    expect(info).toHaveBeenCalledTimes(2);
    expect(info.mock.calls.map((c) => (c[0] as { eventName: string }).eventName)).toEqual([
      'UserRegistered',
      'RestaurantCreated',
    ]);
  });
});
