import { FulfillmentTimeoutScheduler } from '../../../../application/fulfillment/event-handlers/FulfillmentTimeoutScheduler';
import { FulfillmentJobHandler } from '../../../../application/fulfillment/jobs/FulfillmentJobHandler';
import { HandleAssignmentTimeout } from '../../../../application/fulfillment/use-cases/HandleAssignmentTimeout';
import { HandleSlaTimeout } from '../../../../application/fulfillment/use-cases/HandleSlaTimeout';
import { IFulfillmentJobScheduler } from '../../../../application/fulfillment/jobs/FulfillmentJob';
import { Result } from '../../../../domain/shared/Result';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';
import { FULFILLMENT_STATUS } from '../../../../domain/fulfillment/enums/fulfillment-status.enum';
import { RiderOffered } from '../../../../domain/fulfillment/events/RiderOffered';
import { ReadyForPickup } from '../../../../domain/fulfillment/events/ReadyForPickup';
import { OutForDelivery } from '../../../../domain/fulfillment/events/OutForDelivery';

function makeScheduler(): jest.Mocked<IFulfillmentJobScheduler> {
  return {
    schedule: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  } as jest.Mocked<IFulfillmentJobScheduler>;
}

describe('FulfillmentTimeoutScheduler', () => {
  const READY_SLA = 900;
  const DELIVERY_SLA = 2700;

  it('arms an assignment-timeout at the offer expiry with an attempt-scoped jobId', async () => {
    const scheduler = makeScheduler();
    const sut = new FulfillmentTimeoutScheduler(scheduler, READY_SLA, DELIVERY_SLA);
    const event = new RiderOffered({
      fulfillmentId: 'f1',
      riderId: 'r1',
      attempt: 2,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await sut.onRiderOffered(event);

    expect(scheduler.schedule).toHaveBeenCalledTimes(1);
    const [job, opts] = scheduler.schedule.mock.calls[0];
    expect(job).toEqual({ type: 'assignment-timeout', fulfillmentId: 'f1', attempt: 2 });
    expect(opts.jobId).toBe('f1:assignment:2');
    expect(opts.delayMs).toBeGreaterThan(0);
  });

  it('arms a READY_FOR_PICKUP SLA timer with the configured delay', async () => {
    const scheduler = makeScheduler();
    const sut = new FulfillmentTimeoutScheduler(scheduler, READY_SLA, DELIVERY_SLA);

    await sut.onReadyForPickup(new ReadyForPickup({ fulfillmentId: 'f1', restaurantId: 'rest-1', readyAt: new Date() }));

    const [job, opts] = scheduler.schedule.mock.calls[0];
    expect(job).toEqual({ type: 'sla-timeout', fulfillmentId: 'f1', stage: FULFILLMENT_STATUS.READY_FOR_PICKUP });
    expect(opts.jobId).toBe(`f1:sla:${FULFILLMENT_STATUS.READY_FOR_PICKUP}`);
    expect(opts.delayMs).toBe(READY_SLA * 1000);
  });

  it('arms an OUT_FOR_DELIVERY SLA timer', async () => {
    const scheduler = makeScheduler();
    const sut = new FulfillmentTimeoutScheduler(scheduler, READY_SLA, DELIVERY_SLA);

    await sut.onOutForDelivery(new OutForDelivery({ fulfillmentId: 'f1', riderId: 'r1' }));

    const [, opts] = scheduler.schedule.mock.calls[0];
    expect(opts.jobId).toBe(`f1:sla:${FULFILLMENT_STATUS.OUT_FOR_DELIVERY}`);
    expect(opts.delayMs).toBe(DELIVERY_SLA * 1000);
  });

  it('never throws when the scheduler fails (best-effort)', async () => {
    const scheduler = makeScheduler();
    scheduler.schedule.mockRejectedValueOnce(new Error('redis down'));
    const sut = new FulfillmentTimeoutScheduler(scheduler, READY_SLA, DELIVERY_SLA);

    await expect(
      sut.onReadyForPickup(new ReadyForPickup({ fulfillmentId: 'f1', restaurantId: 'rest-1', readyAt: new Date() }))
    ).resolves.toBeUndefined();
  });
});

describe('FulfillmentJobHandler', () => {
  function mocks() {
    const assignment = { execute: jest.fn().mockResolvedValue(Result.ok<void>(undefined)) } as unknown as HandleAssignmentTimeout;
    const sla = { execute: jest.fn().mockResolvedValue(Result.ok<void>(undefined)) } as unknown as HandleSlaTimeout;
    return { assignment, sla, handler: new FulfillmentJobHandler(assignment, sla) };
  }

  it('routes assignment-timeout jobs to HandleAssignmentTimeout', async () => {
    const { assignment, handler } = mocks();
    await handler.handle({ type: 'assignment-timeout', fulfillmentId: 'f1', attempt: 1 });
    expect(assignment.execute).toHaveBeenCalledWith({ fulfillmentId: 'f1', attempt: 1 });
  });

  it('routes sla-timeout jobs to HandleSlaTimeout', async () => {
    const { sla, handler } = mocks();
    await handler.handle({ type: 'sla-timeout', fulfillmentId: 'f1', stage: 'READY_FOR_PICKUP' });
    expect(sla.execute).toHaveBeenCalledWith({ fulfillmentId: 'f1', stage: 'READY_FOR_PICKUP' });
  });

  it('throws when a handler use case fails (so BullMQ retries, then retains the job)', async () => {
    const assignment = {
      execute: jest.fn().mockResolvedValue(Result.fail<void>(new ValidationError('boom'))),
    } as unknown as HandleAssignmentTimeout;
    const sla = { execute: jest.fn() } as unknown as HandleSlaTimeout;
    const handler = new FulfillmentJobHandler(assignment, sla);
    await expect(handler.handle({ type: 'assignment-timeout', fulfillmentId: 'f1', attempt: 1 })).rejects.toThrow('boom');
  });
});
