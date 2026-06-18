import {
  registerEngagementEventHandlers,
  EngagementEventHandlers,
} from '../../../../../application/engagement/event-handlers/EngagementEventRegistry';
import { IEventBus } from '../../../../../application/shared/events/IEventBus';
import { DomainEvent } from '../../../../../domain/shared/DomainEvent';

function fakeBus() {
  const subs = new Map<string, (e: DomainEvent) => Promise<void>>();
  const bus = {
    subscribe: jest.fn((name: string, handler: (e: DomainEvent) => Promise<void>) => subs.set(name, handler)),
    publish: jest.fn(),
    publishAll: jest.fn(),
  } as unknown as IEventBus;
  return { bus, subs };
}

function handlerStubs(): EngagementEventHandlers {
  const make = () => ({ handle: jest.fn().mockResolvedValue(undefined) });
  return {
    onUserRegistered: make(),
    onPasswordChanged: make(),
    onPasswordResetRequested: make(),
    onFulfillmentCreated: make(),
    onReadyForPickup: make(),
    onRiderAssigned: make(),
    onOutForDelivery: make(),
    onDeliveryCompleted: make(),
    onFulfillmentCancelled: make(),
  } as unknown as EngagementEventHandlers;
}

const EXPECTED_EVENTS = [
  'UserRegistered',
  'PasswordChanged',
  'PasswordResetRequested',
  'FulfillmentCreated',
  'ReadyForPickup',
  'RiderAssigned',
  'OutForDelivery',
  'DeliveryCompleted',
  'FulfillmentCancelled',
];

describe('registerEngagementEventHandlers', () => {
  it('subscribes exactly the nine consumed cross-context events', () => {
    const { bus, subs } = fakeBus();

    registerEngagementEventHandlers(bus, handlerStubs());

    expect([...subs.keys()].sort()).toEqual([...EXPECTED_EVENTS].sort());
  });

  it('routes a published event to its matching handler', async () => {
    const { bus, subs } = fakeBus();
    const handlers = handlerStubs();

    registerEngagementEventHandlers(bus, handlers);

    const event = { eventName: 'DeliveryCompleted', aggregateId: 'ful-1', eventId: 'e', occurredOn: new Date() };
    await subs.get('DeliveryCompleted')!(event as DomainEvent);

    expect(handlers.onDeliveryCompleted.handle).toHaveBeenCalledWith(event);
    expect(handlers.onUserRegistered.handle).not.toHaveBeenCalled();
  });
});
