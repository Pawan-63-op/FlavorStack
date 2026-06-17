import { HandleSlaTimeout } from '../../../../application/fulfillment/use-cases/HandleSlaTimeout';
import { CancelFulfillment } from '../../../../application/fulfillment/use-cases/CancelFulfillment';
import { Result } from '../../../../domain/shared/Result';
import { Fulfillment } from '../../../../domain/fulfillment/entities/Fulfillment';
import { FULFILLMENT_STATUS } from '../../../../domain/fulfillment/enums/fulfillment-status.enum';
import { CANCELLED_BY } from '../../../../domain/fulfillment/enums/cancelled-by.enum';
import { buildReadyFulfillment, makeRepo } from './assignment-uc-fixtures';

const RIDER_1 = 'rider-1';

function mockCancel(): jest.Mocked<CancelFulfillment> {
  return { execute: jest.fn().mockResolvedValue(Result.ok({})) } as unknown as jest.Mocked<CancelFulfillment>;
}

/** A fulfillment that is OUT_FOR_DELIVERY (post-pickup). */
function buildOutForDelivery(): Fulfillment {
  const f = buildReadyFulfillment();
  f.offerToRider(RIDER_1, new Date(Date.now() + 60_000));
  f.acceptByRider(RIDER_1);
  f.confirmPickup(RIDER_1);
  f.startDelivery(RIDER_1);
  f.pullDomainEvents();
  return f;
}

describe('HandleSlaTimeout', () => {
  it('auto-cancels (SYSTEM) a pre-pickup fulfillment still stuck at the armed stage', async () => {
    const f = buildReadyFulfillment(); // READY_FOR_PICKUP
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const cancel = mockCancel();
    const uc = new HandleSlaTimeout(repo, cancel);

    const result = await uc.execute({ fulfillmentId: f.id.toString(), stage: FULFILLMENT_STATUS.READY_FOR_PICKUP });

    expect(result.isSuccess).toBe(true);
    expect(cancel.execute).toHaveBeenCalledWith(
      expect.objectContaining({ fulfillmentId: f.id.toString(), cancelledBy: CANCELLED_BY.SYSTEM })
    );
  });

  it('flags (no cancel) a post-pickup SLA breach', async () => {
    const f = buildOutForDelivery();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const cancel = mockCancel();
    const uc = new HandleSlaTimeout(repo, cancel);

    const result = await uc.execute({ fulfillmentId: f.id.toString(), stage: FULFILLMENT_STATUS.OUT_FOR_DELIVERY });

    expect(result.isSuccess).toBe(true);
    expect(cancel.execute).not.toHaveBeenCalled();
  });

  it('is a no-op when the order advanced past the armed stage (SLA met)', async () => {
    const f = buildOutForDelivery(); // now OUT_FOR_DELIVERY
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const cancel = mockCancel();
    const uc = new HandleSlaTimeout(repo, cancel);

    // The SLA timer was armed at READY_FOR_PICKUP but the order has progressed → nothing to do.
    const result = await uc.execute({ fulfillmentId: f.id.toString(), stage: FULFILLMENT_STATUS.READY_FOR_PICKUP });

    expect(result.isSuccess).toBe(true);
    expect(cancel.execute).not.toHaveBeenCalled();
  });
});
