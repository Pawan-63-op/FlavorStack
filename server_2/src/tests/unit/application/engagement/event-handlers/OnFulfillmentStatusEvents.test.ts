import { OnReadyForPickup } from '../../../../../application/engagement/event-handlers/OnReadyForPickup';
import { OnRiderAssigned } from '../../../../../application/engagement/event-handlers/OnRiderAssigned';
import { OnOutForDelivery } from '../../../../../application/engagement/event-handlers/OnOutForDelivery';
import { OnFulfillmentCancelled } from '../../../../../application/engagement/event-handlers/OnFulfillmentCancelled';
import { NOTIFICATION_CATEGORY } from '../../../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../../../domain/engagement/enums/notification-channel.enum';
import { DispatchNotificationDto } from '../../../../../application/engagement/dtos/DispatchNotificationDto';
import { Result } from '../../../../../domain/shared/Result';
import { logger } from '../../../../../infrastructure/observability/logger';
import { makeDispatch, asDispatch, makeFulfillmentGateway, busEvent } from './_handler-helpers';

describe('OnReadyForPickup', () => {
  it('resolves the customer via the fulfillment gateway and dispatches ready_for_pickup (ORDER_UPDATES/PUSH)', async () => {
    const dispatch = makeDispatch();
    const gateway = makeFulfillmentGateway();
    const handler = new OnReadyForPickup(asDispatch(dispatch), gateway);

    await handler.handle(busEvent({ eventName: 'ReadyForPickup', aggregateId: 'ful-1', readyAt: new Date() }));

    expect(gateway.getForReview).toHaveBeenCalledWith('ful-1');
    const dto = dispatch.execute.mock.calls[0][0] as DispatchNotificationDto;
    expect(dto.recipientUserId).toBe('cust-1');
    expect(dto.templateKey).toBe('ready_for_pickup');
    expect(dto.category).toBe(NOTIFICATION_CATEGORY.ORDER_UPDATES);
    expect(dto.channel).toBe(NOTIFICATION_CHANNEL.INBOX);
  });

  it('skips and logs (does not dedupe) when the fulfillment cannot be found', async () => {
    const dispatch = makeDispatch();
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => logger);
    const gateway = makeFulfillmentGateway(null);
    const handler = new OnReadyForPickup(asDispatch(dispatch), gateway);

    const event = busEvent({ eventName: 'ReadyForPickup', aggregateId: 'ful-1', readyAt: new Date() });
    await handler.handle(event);
    await handler.handle(event);

    expect(dispatch.execute).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    expect(gateway.getForReview).toHaveBeenCalledTimes(2); // retried, not deduped
    warnSpy.mockRestore();
  });

  it('does not dedupe a failed dispatch — a redelivery re-attempts', async () => {
    const dispatch = makeDispatch();
    dispatch.execute
      .mockResolvedValueOnce(Result.fail('boom'))
      .mockResolvedValueOnce(Result.ok({ outcome: 'DISPATCHED', dedupeKey: 'k' }));
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => logger);
    const gateway = makeFulfillmentGateway();
    const handler = new OnReadyForPickup(asDispatch(dispatch), gateway);

    const event = busEvent({ eventName: 'ReadyForPickup', aggregateId: 'ful-1', readyAt: new Date() });
    await handler.handle(event);
    await handler.handle(event);

    expect(dispatch.execute).toHaveBeenCalledTimes(2); // failure was not marked processed
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  // Phase 6 removed the per-handler in-memory `processedEventIds` set. The durable guard is
  // `DispatchNotification`'s dedupe key (a unique index on `notifications`), which turns a
  // redelivery into a SKIPPED/duplicate outcome instead of a second inbox row.
  it('delegates every redelivery — de-duplication belongs to DispatchNotification', async () => {
    const dispatch = makeDispatch();
    const gateway = makeFulfillmentGateway();
    const handler = new OnReadyForPickup(asDispatch(dispatch), gateway);

    const event = busEvent({ eventName: 'ReadyForPickup', aggregateId: 'ful-1', readyAt: new Date() });
    await handler.handle(event);
    await handler.handle(event);

    expect(dispatch.execute).toHaveBeenCalledTimes(2);
  });
});

describe('OnRiderAssigned', () => {
  it('dispatches rider_assigned to the resolved customer (DELIVERY/PUSH)', async () => {
    const dispatch = makeDispatch();
    const gateway = makeFulfillmentGateway();
    const handler = new OnRiderAssigned(asDispatch(dispatch), gateway);

    await handler.handle(
      busEvent({ eventName: 'RiderAssigned', aggregateId: 'ful-1', riderId: 'rider-1', assignedAt: new Date() })
    );

    const dto = dispatch.execute.mock.calls[0][0] as DispatchNotificationDto;
    expect(dto.recipientUserId).toBe('cust-1');
    expect(dto.templateKey).toBe('rider_assigned');
    expect(dto.category).toBe(NOTIFICATION_CATEGORY.DELIVERY);
    expect(dto.channel).toBe(NOTIFICATION_CHANNEL.INBOX);
  });

  it('skips and logs (does not dedupe) when the fulfillment cannot be found', async () => {
    const dispatch = makeDispatch();
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => logger);
    const gateway = makeFulfillmentGateway(null);
    const handler = new OnRiderAssigned(asDispatch(dispatch), gateway);

    const event = busEvent({ eventName: 'RiderAssigned', aggregateId: 'ful-1', riderId: 'rider-1' });
    await handler.handle(event);
    await handler.handle(event);

    expect(dispatch.execute).not.toHaveBeenCalled();
    expect(gateway.getForReview).toHaveBeenCalledTimes(2); // retried, not deduped
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('does not dedupe a failed dispatch — a redelivery re-attempts', async () => {
    const dispatch = makeDispatch();
    dispatch.execute
      .mockResolvedValueOnce(Result.fail('boom'))
      .mockResolvedValueOnce(Result.ok({ outcome: 'DISPATCHED', dedupeKey: 'k' }));
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => logger);
    const gateway = makeFulfillmentGateway();
    const handler = new OnRiderAssigned(asDispatch(dispatch), gateway);

    const event = busEvent({ eventName: 'RiderAssigned', aggregateId: 'ful-1', riderId: 'rider-1' });
    await handler.handle(event);
    await handler.handle(event);

    expect(dispatch.execute).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('delegates every redelivery — de-duplication belongs to DispatchNotification', async () => {
    const dispatch = makeDispatch();
    const gateway = makeFulfillmentGateway();
    const handler = new OnRiderAssigned(asDispatch(dispatch), gateway);

    const event = busEvent({ eventName: 'RiderAssigned', aggregateId: 'ful-1', riderId: 'rider-1' });
    await handler.handle(event);
    await handler.handle(event);

    expect(dispatch.execute).toHaveBeenCalledTimes(2);
  });
});

describe('OnOutForDelivery', () => {
  it('dispatches out_for_delivery to the resolved customer (DELIVERY/PUSH)', async () => {
    const dispatch = makeDispatch();
    const gateway = makeFulfillmentGateway();
    const handler = new OnOutForDelivery(asDispatch(dispatch), gateway);

    await handler.handle(busEvent({ eventName: 'OutForDelivery', aggregateId: 'ful-1', riderId: 'rider-1' }));

    const dto = dispatch.execute.mock.calls[0][0] as DispatchNotificationDto;
    expect(dto.recipientUserId).toBe('cust-1');
    expect(dto.templateKey).toBe('out_for_delivery');
    expect(dto.category).toBe(NOTIFICATION_CATEGORY.DELIVERY);
    expect(dto.channel).toBe(NOTIFICATION_CHANNEL.INBOX);
  });

  it('skips and logs (does not dedupe) when the fulfillment cannot be found', async () => {
    const dispatch = makeDispatch();
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => logger);
    const gateway = makeFulfillmentGateway(null);
    const handler = new OnOutForDelivery(asDispatch(dispatch), gateway);

    const event = busEvent({ eventName: 'OutForDelivery', aggregateId: 'ful-1', riderId: 'rider-1' });
    await handler.handle(event);
    await handler.handle(event);

    expect(dispatch.execute).not.toHaveBeenCalled();
    expect(gateway.getForReview).toHaveBeenCalledTimes(2); // retried, not deduped
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('does not dedupe a failed dispatch — a redelivery re-attempts', async () => {
    const dispatch = makeDispatch();
    dispatch.execute
      .mockResolvedValueOnce(Result.fail('boom'))
      .mockResolvedValueOnce(Result.ok({ outcome: 'DISPATCHED', dedupeKey: 'k' }));
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => logger);
    const gateway = makeFulfillmentGateway();
    const handler = new OnOutForDelivery(asDispatch(dispatch), gateway);

    const event = busEvent({ eventName: 'OutForDelivery', aggregateId: 'ful-1', riderId: 'rider-1' });
    await handler.handle(event);
    await handler.handle(event);

    expect(dispatch.execute).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('delegates every redelivery — de-duplication belongs to DispatchNotification', async () => {
    const dispatch = makeDispatch();
    const gateway = makeFulfillmentGateway();
    const handler = new OnOutForDelivery(asDispatch(dispatch), gateway);

    const event = busEvent({ eventName: 'OutForDelivery', aggregateId: 'ful-1', riderId: 'rider-1' });
    await handler.handle(event);
    await handler.handle(event);

    expect(dispatch.execute).toHaveBeenCalledTimes(2);
  });
});

describe('OnFulfillmentCancelled', () => {
  it('dispatches order_cancelled with the reason var to the resolved customer (ORDER_UPDATES/PUSH)', async () => {
    const dispatch = makeDispatch();
    const gateway = makeFulfillmentGateway();
    const handler = new OnFulfillmentCancelled(asDispatch(dispatch), gateway);

    await handler.handle(
      busEvent({ eventName: 'FulfillmentCancelled', aggregateId: 'ful-1', reason: 'restaurant_closed' })
    );

    const dto = dispatch.execute.mock.calls[0][0] as DispatchNotificationDto;
    expect(dto.recipientUserId).toBe('cust-1');
    expect(dto.templateKey).toBe('order_cancelled');
    expect(dto.category).toBe(NOTIFICATION_CATEGORY.ORDER_UPDATES);
    expect(dto.channel).toBe(NOTIFICATION_CHANNEL.INBOX);
    expect(dto.vars).toMatchObject({ reason: 'restaurant_closed' });
  });

  it('skips and logs (does not dedupe) when the fulfillment cannot be found', async () => {
    const dispatch = makeDispatch();
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => logger);
    const gateway = makeFulfillmentGateway(null);
    const handler = new OnFulfillmentCancelled(asDispatch(dispatch), gateway);

    const event = busEvent({ eventName: 'FulfillmentCancelled', aggregateId: 'ful-1', reason: 'x' });
    await handler.handle(event);
    await handler.handle(event);

    expect(dispatch.execute).not.toHaveBeenCalled();
    expect(gateway.getForReview).toHaveBeenCalledTimes(2); // retried, not deduped
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('does not dedupe a failed dispatch — a redelivery re-attempts', async () => {
    const dispatch = makeDispatch();
    dispatch.execute
      .mockResolvedValueOnce(Result.fail('boom'))
      .mockResolvedValueOnce(Result.ok({ outcome: 'DISPATCHED', dedupeKey: 'k' }));
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => logger);
    const gateway = makeFulfillmentGateway();
    const handler = new OnFulfillmentCancelled(asDispatch(dispatch), gateway);

    const event = busEvent({ eventName: 'FulfillmentCancelled', aggregateId: 'ful-1', reason: 'x' });
    await handler.handle(event);
    await handler.handle(event);

    expect(dispatch.execute).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('delegates every redelivery — de-duplication belongs to DispatchNotification', async () => {
    const dispatch = makeDispatch();
    const gateway = makeFulfillmentGateway();
    const handler = new OnFulfillmentCancelled(asDispatch(dispatch), gateway);

    const event = busEvent({ eventName: 'FulfillmentCancelled', aggregateId: 'ful-1', reason: 'x' });
    await handler.handle(event);
    await handler.handle(event);

    expect(dispatch.execute).toHaveBeenCalledTimes(2);
  });
});
