import { OnFulfillmentCreated } from '../../../../../application/engagement/event-handlers/OnFulfillmentCreated';
import { NOTIFICATION_CATEGORY } from '../../../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../../../domain/engagement/enums/notification-channel.enum';
import { DispatchNotificationDto } from '../../../../../application/engagement/dtos/DispatchNotificationDto';
import { Result } from '../../../../../domain/shared/Result';
import { logger } from '../../../../../infrastructure/observability/logger';
import { makeDispatch, asDispatch, makeEligibilityRepo, busEvent } from './_handler-helpers';

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
  it('seeds ReviewEligibility (customer + restaurant, not delivered, not reviewed)', async () => {
    const dispatch = makeDispatch();
    const eligibilityRepo = makeEligibilityRepo();
    const handler = new OnFulfillmentCreated(asDispatch(dispatch), eligibilityRepo);

    await handler.handle(fulfillmentCreated());

    expect(eligibilityRepo.upsert).toHaveBeenCalledTimes(1);
    expect(eligibilityRepo.upsert).toHaveBeenCalledWith({
      fulfillmentId: 'ful-1',
      customerId: 'cust-1',
      restaurantId: 'rest-1',
      deliveredAt: null,
      reviewed: false,
    });
  });

  it('dispatches the order_confirmed notification to the customer', async () => {
    const dispatch = makeDispatch();
    const handler = new OnFulfillmentCreated(asDispatch(dispatch), makeEligibilityRepo());

    await handler.handle(fulfillmentCreated());

    expect(dispatch.execute).toHaveBeenCalledTimes(1);
    const dto = dispatch.execute.mock.calls[0][0] as DispatchNotificationDto;
    expect(dto.recipientUserId).toBe('cust-1');
    expect(dto.templateKey).toBe('order_confirmed');
    expect(dto.category).toBe(NOTIFICATION_CATEGORY.ORDER_UPDATES);
    expect(dto.channel).toBe(NOTIFICATION_CHANNEL.PUSH);
    expect(dto.sourceEventId).toBe('evt-1');
  });

  it('does not overwrite an existing eligibility row (preserves deliveredAt on redelivery)', async () => {
    const dispatch = makeDispatch();
    const eligibilityRepo = makeEligibilityRepo({
      findByFulfillmentId: jest.fn().mockResolvedValue({
        fulfillmentId: 'ful-1',
        customerId: 'cust-1',
        restaurantId: 'rest-1',
        deliveredAt: new Date(),
        reviewed: false,
      }),
    });
    const handler = new OnFulfillmentCreated(asDispatch(dispatch), eligibilityRepo);

    await handler.handle(fulfillmentCreated());

    expect(eligibilityRepo.upsert).not.toHaveBeenCalled();
  });

  it('is idempotent across redelivery of the same eventId', async () => {
    const dispatch = makeDispatch();
    const eligibilityRepo = makeEligibilityRepo();
    const handler = new OnFulfillmentCreated(asDispatch(dispatch), eligibilityRepo);

    const event = fulfillmentCreated();
    await handler.handle(event);
    await handler.handle(event);

    expect(eligibilityRepo.upsert).toHaveBeenCalledTimes(1);
    expect(dispatch.execute).toHaveBeenCalledTimes(1);
  });

  it('does not dedupe a failed dispatch — a redelivery re-attempts (eligibility seed stays insert-if-absent)', async () => {
    const dispatch = makeDispatch();
    dispatch.execute
      .mockResolvedValueOnce(Result.fail('boom'))
      .mockResolvedValueOnce(Result.ok({ outcome: 'DISPATCHED', dedupeKey: 'k' }));
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => logger);
    const seeded = { fulfillmentId: 'ful-1', customerId: 'cust-1', restaurantId: 'rest-1', deliveredAt: null, reviewed: false };
    let row: typeof seeded | null = null;
    const eligibilityRepo = makeEligibilityRepo({
      findByFulfillmentId: jest.fn().mockImplementation(async () => row),
      upsert: jest.fn().mockImplementation(async () => {
        row = seeded;
      }),
    });
    const handler = new OnFulfillmentCreated(asDispatch(dispatch), eligibilityRepo);

    const event = fulfillmentCreated();
    await handler.handle(event);
    await handler.handle(event);

    expect(dispatch.execute).toHaveBeenCalledTimes(2); // failed dispatch not marked processed
    expect(eligibilityRepo.upsert).toHaveBeenCalledTimes(1); // seed already present on retry → not re-inserted
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
