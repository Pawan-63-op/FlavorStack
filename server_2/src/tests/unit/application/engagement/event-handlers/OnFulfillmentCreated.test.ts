import { OnFulfillmentCreated } from '../../../../../application/engagement/event-handlers/OnFulfillmentCreated';
import { NOTIFICATION_CATEGORY } from '../../../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../../../domain/engagement/enums/notification-channel.enum';
import { DispatchNotificationDto } from '../../../../../application/engagement/dtos/DispatchNotificationDto';
import { Result } from '../../../../../domain/shared/Result';
import { logger } from '../../../../../infrastructure/observability/logger';
import { makeDispatch, asDispatch, busEvent } from './_handler-helpers';

function fulfillmentCreated(overrides: Record<string, unknown> = {}) {
  return busEvent({
    eventName: 'FulfillmentCreated',
    aggregateId: 'ful-1',
    orderRequestId: 'ord-1',
    customerId: 'cust-1',
    restaurantId: 'rest-1',
    total: { amount: 45000, currency: 'INR' },
    ...overrides,
  });
}

describe('OnFulfillmentCreated', () => {
  it('dispatches the order_confirmed notification to the customer', async () => {
    const dispatch = makeDispatch();
    const handler = new OnFulfillmentCreated(asDispatch(dispatch));

    await handler.handle(fulfillmentCreated());

    expect(dispatch.execute).toHaveBeenCalledTimes(1);
    const dto = dispatch.execute.mock.calls[0][0] as DispatchNotificationDto;
    expect(dto.recipientUserId).toBe('cust-1');
    expect(dto.templateKey).toBe('order_confirmed');
    expect(dto.category).toBe(NOTIFICATION_CATEGORY.ORDER_UPDATES);
    expect(dto.channel).toBe(NOTIFICATION_CHANNEL.INBOX);
    expect(dto.sourceEventId).toBe('evt-1');
  });

  it('takes the recipient straight off the event — no read of any other collection', async () => {
    // FulfillmentCreated is the one lifecycle event that carries customerId, which is why
    // this handler needs no gateway at all (the other five resolve it via IFulfillmentGateway).
    const dispatch = makeDispatch();
    const handler = new OnFulfillmentCreated(asDispatch(dispatch));

    await handler.handle(fulfillmentCreated({ customerId: 'cust-9' }));

    const dto = dispatch.execute.mock.calls[0][0] as DispatchNotificationDto;
    expect(dto.recipientUserId).toBe('cust-9');
  });

  // Phase 6 removed the per-handler in-memory `processedEventIds` set. The durable guard is
  // `DispatchNotification`'s dedupe key (a unique index on `notifications`), which turns a
  // redelivery into a SKIPPED/duplicate outcome instead of a second inbox row.
  it('delegates every redelivery — de-duplication belongs to DispatchNotification', async () => {
    const dispatch = makeDispatch();
    const handler = new OnFulfillmentCreated(asDispatch(dispatch));

    const event = fulfillmentCreated();
    await handler.handle(event);
    await handler.handle(event);

    expect(dispatch.execute).toHaveBeenCalledTimes(2);
  });

  it('does not dedupe a failed dispatch — a redelivery re-attempts', async () => {
    const dispatch = makeDispatch();
    dispatch.execute
      .mockResolvedValueOnce(Result.fail('boom'))
      .mockResolvedValueOnce(Result.ok({ outcome: 'DISPATCHED', dedupeKey: 'k' }));
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => logger);
    const handler = new OnFulfillmentCreated(asDispatch(dispatch));

    const event = fulfillmentCreated();
    await handler.handle(event);
    await handler.handle(event);

    expect(dispatch.execute).toHaveBeenCalledTimes(2); // failed dispatch not marked processed
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
