import { OnDeliveryCompleted } from '../../../../../application/engagement/event-handlers/OnDeliveryCompleted';
import { NOTIFICATION_CATEGORY } from '../../../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../../../domain/engagement/enums/notification-channel.enum';
import { DispatchNotificationDto } from '../../../../../application/engagement/dtos/DispatchNotificationDto';
import { Result } from '../../../../../domain/shared/Result';
import { logger } from '../../../../../infrastructure/observability/logger';
import { makeDispatch, asDispatch, makeEligibilityRepo, busEvent } from './_handler-helpers';

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

const seeded = {
  fulfillmentId: 'ful-1',
  customerId: 'cust-1',
  restaurantId: 'rest-1',
  deliveredAt: null,
  reviewed: false,
};

describe('OnDeliveryCompleted', () => {
  it('resolves customer/restaurant from eligibility (NOT the event payload, which lacks them)', async () => {
    const dispatch = makeDispatch();
    const repo = makeEligibilityRepo({ findByFulfillmentId: jest.fn().mockResolvedValue(seeded) });
    const handler = new OnDeliveryCompleted(asDispatch(dispatch), repo);

    await handler.handle(deliveryCompleted());

    expect(repo.findByFulfillmentId).toHaveBeenCalledWith('ful-1');
    const dto = dispatch.execute.mock.calls[0][0] as DispatchNotificationDto;
    expect(dto.recipientUserId).toBe('cust-1');
  });

  it('marks the eligibility delivered (sets deliveredAt, preserves customer/restaurant, keeps reviewed=false)', async () => {
    const dispatch = makeDispatch();
    const repo = makeEligibilityRepo({ findByFulfillmentId: jest.fn().mockResolvedValue(seeded) });
    const handler = new OnDeliveryCompleted(asDispatch(dispatch), repo);

    await handler.handle(deliveryCompleted());

    expect(repo.upsert).toHaveBeenCalledTimes(1);
    expect(repo.upsert).toHaveBeenCalledWith({
      fulfillmentId: 'ful-1',
      customerId: 'cust-1',
      restaurantId: 'rest-1',
      deliveredAt,
      reviewed: false,
    });
  });

  it('falls back to now() when the event omits deliveredAt (order still becomes reviewable)', async () => {
    const dispatch = makeDispatch();
    const repo = makeEligibilityRepo({ findByFulfillmentId: jest.fn().mockResolvedValue(seeded) });
    const handler = new OnDeliveryCompleted(asDispatch(dispatch), repo);
    const before = Date.now();

    await handler.handle(deliveryCompleted({ deliveredAt: undefined }));

    expect(repo.upsert).toHaveBeenCalledTimes(1);
    const written = repo.upsert.mock.calls[0][0];
    expect(written.deliveredAt).toBeInstanceOf(Date);
    expect(written.deliveredAt!.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('dispatches the delivered notification (DELIVERY/PUSH) to the resolved customer', async () => {
    const dispatch = makeDispatch();
    const repo = makeEligibilityRepo({ findByFulfillmentId: jest.fn().mockResolvedValue(seeded) });
    const handler = new OnDeliveryCompleted(asDispatch(dispatch), repo);

    await handler.handle(deliveryCompleted());

    const dto = dispatch.execute.mock.calls[0][0] as DispatchNotificationDto;
    expect(dto.templateKey).toBe('delivered');
    expect(dto.category).toBe(NOTIFICATION_CATEGORY.DELIVERY);
    expect(dto.channel).toBe(NOTIFICATION_CHANNEL.PUSH);
    expect(dto.sourceEventId).toBe('evt-1');
  });

  it('skips and logs (no mark-delivered, no dispatch) when eligibility is missing', async () => {
    const dispatch = makeDispatch();
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => logger);
    const repo = makeEligibilityRepo({ findByFulfillmentId: jest.fn().mockResolvedValue(null) });
    const handler = new OnDeliveryCompleted(asDispatch(dispatch), repo);

    await handler.handle(deliveryCompleted());

    expect(repo.upsert).not.toHaveBeenCalled();
    expect(dispatch.execute).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('is idempotent across redelivery of the same eventId', async () => {
    const dispatch = makeDispatch();
    const repo = makeEligibilityRepo({ findByFulfillmentId: jest.fn().mockResolvedValue(seeded) });
    const handler = new OnDeliveryCompleted(asDispatch(dispatch), repo);

    const event = deliveryCompleted();
    await handler.handle(event);
    await handler.handle(event);

    expect(repo.upsert).toHaveBeenCalledTimes(1);
    expect(dispatch.execute).toHaveBeenCalledTimes(1);
  });

  it('does not dedupe a failed dispatch — a redelivery re-attempts', async () => {
    const dispatch = makeDispatch();
    dispatch.execute
      .mockResolvedValueOnce(Result.fail('boom'))
      .mockResolvedValueOnce(Result.ok({ outcome: 'DISPATCHED', dedupeKey: 'k' }));
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => logger);
    const repo = makeEligibilityRepo({ findByFulfillmentId: jest.fn().mockResolvedValue(seeded) });
    const handler = new OnDeliveryCompleted(asDispatch(dispatch), repo);

    const event = deliveryCompleted();
    await handler.handle(event);
    await handler.handle(event);

    expect(dispatch.execute).toHaveBeenCalledTimes(2); // failed dispatch not marked processed
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
