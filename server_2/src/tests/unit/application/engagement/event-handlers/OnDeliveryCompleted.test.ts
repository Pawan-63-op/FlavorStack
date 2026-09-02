import { OnDeliveryCompleted } from '../../../../../application/engagement/event-handlers/OnDeliveryCompleted';
import { NOTIFICATION_CATEGORY } from '../../../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../../../domain/engagement/enums/notification-channel.enum';
import { DispatchNotificationDto } from '../../../../../application/engagement/dtos/DispatchNotificationDto';
import { Result } from '../../../../../domain/shared/Result';
import { logger } from '../../../../../infrastructure/observability/logger';
import { makeDispatch, asDispatch, makeFulfillmentGateway, busEvent } from './_handler-helpers';

const deliveredAt = new Date('2026-06-17T10:00:00Z');

function deliveryCompleted(overrides: Record<string, unknown> = {}) {
  return busEvent({
    eventName: 'DeliveryCompleted',
    aggregateId: 'ful-1',
    riderId: 'rider-1',
    deliveredAt,
    ...overrides,
  });
}

describe('OnDeliveryCompleted', () => {
  it('resolves the customer via the fulfillment gateway (the event payload lacks it)', async () => {
    const dispatch = makeDispatch();
    const gateway = makeFulfillmentGateway();
    const handler = new OnDeliveryCompleted(asDispatch(dispatch), gateway);

    await handler.handle(deliveryCompleted());

    expect(gateway.getForReview).toHaveBeenCalledWith('ful-1');
    const dto = dispatch.execute.mock.calls[0][0] as DispatchNotificationDto;
    expect(dto.recipientUserId).toBe('cust-1');
  });

  it('writes nothing — review eligibility is derived from the fulfillment, not stamped here', async () => {
    const dispatch = makeDispatch();
    const gateway = makeFulfillmentGateway();
    const handler = new OnDeliveryCompleted(asDispatch(dispatch), gateway);

    await handler.handle(deliveryCompleted());

    // The gateway is read-only: `getForReview` is its entire surface, so there is no
    // deliveredAt write-back to assert absent.
    expect(Object.keys(gateway)).toEqual(['getForReview']);
    expect(dispatch.execute).toHaveBeenCalledTimes(1);
  });

  it('dispatches the delivered notification (DELIVERY/PUSH) to the resolved customer', async () => {
    const dispatch = makeDispatch();
    const handler = new OnDeliveryCompleted(asDispatch(dispatch), makeFulfillmentGateway());

    await handler.handle(deliveryCompleted());

    const dto = dispatch.execute.mock.calls[0][0] as DispatchNotificationDto;
    expect(dto.templateKey).toBe('delivered');
    expect(dto.category).toBe(NOTIFICATION_CATEGORY.DELIVERY);
    expect(dto.channel).toBe(NOTIFICATION_CHANNEL.INBOX);
    expect(dto.sourceEventId).toBe('evt-1');
  });

  it('skips and logs (no dispatch) when the fulfillment cannot be found', async () => {
    const dispatch = makeDispatch();
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => logger);
    const handler = new OnDeliveryCompleted(asDispatch(dispatch), makeFulfillmentGateway(null));

    await handler.handle(deliveryCompleted());

    expect(dispatch.execute).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  // Phase 6 removed the per-handler in-memory `processedEventIds` set. The durable guard is
  // `DispatchNotification`'s dedupe key (a unique index on `notifications`), which turns a
  // redelivery into a SKIPPED/duplicate outcome instead of a second inbox row.
  it('delegates every redelivery — de-duplication belongs to DispatchNotification', async () => {
    const dispatch = makeDispatch();
    const gateway = makeFulfillmentGateway();
    const handler = new OnDeliveryCompleted(asDispatch(dispatch), gateway);

    const event = deliveryCompleted();
    await handler.handle(event);
    await handler.handle(event);

    expect(gateway.getForReview).toHaveBeenCalledTimes(2);
    expect(dispatch.execute).toHaveBeenCalledTimes(2);
  });

  it('does not dedupe a failed dispatch — a redelivery re-attempts', async () => {
    const dispatch = makeDispatch();
    dispatch.execute
      .mockResolvedValueOnce(Result.fail('boom'))
      .mockResolvedValueOnce(Result.ok({ outcome: 'DISPATCHED', dedupeKey: 'k' }));
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => logger);
    const handler = new OnDeliveryCompleted(asDispatch(dispatch), makeFulfillmentGateway());

    const event = deliveryCompleted();
    await handler.handle(event);
    await handler.handle(event);

    expect(dispatch.execute).toHaveBeenCalledTimes(2); // failed dispatch not marked processed
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
