import { CancelFulfillment } from '../../../../application/fulfillment/use-cases/CancelFulfillment';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { FULFILLMENT_STATUS } from '../../../../domain/fulfillment/enums/fulfillment-status.enum';
import { CANCELLED_BY } from '../../../../domain/fulfillment/enums/cancelled-by.enum';
import { Fulfillment } from '../../../../domain/fulfillment/entities/Fulfillment';
import { FulfillmentLine } from '../../../../domain/fulfillment/value-objects/FulfillmentLine';
import { DeliveryAddress } from '../../../../domain/fulfillment/value-objects/DeliveryAddress';
import { GeoPoint } from '../../../../domain/identity/value-objects/GeoPoint.vo';
import { makeRepo, makeUnitOfWork, makeOutbox, makeEventBus, money } from './assignment-uc-fixtures';

const CUSTOMER_ID = 'cust-1';
const RESTAURANT_ID = 'rest-1';

function buildCreatedFulfillment(): Fulfillment {
  const f = Fulfillment.createFromOrderRequested({
    orderRequestId: 'order-req-1',
    customerId: CUSTOMER_ID,
    restaurantId: RESTAURANT_ID,
    lines: [
      FulfillmentLine.create({
        menuItemId: 'i1',
        name: 'X',
        quantity: 1,
        selectedOptions: [],
        lineTotal: money(100),
      }).getValue(),
    ],
    deliveryAddress: DeliveryAddress.create({
      street: 'A',
      city: 'B',
      state: 'C',
      pinCode: '000001',
      coordinates: GeoPoint.create(0, 0).getValue(),
    }).getValue(),
    pricingTotal: money(100),
  }).getValue();
  f.pullDomainEvents();
  return f;
}

describe('CancelFulfillment', () => {
  it('cancels by the owning customer, appends FulfillmentCancelled, publishes', async () => {
    const f = buildCreatedFulfillment();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const outbox = makeOutbox();
    const bus = makeEventBus();
    const uc = new CancelFulfillment(repo, makeUnitOfWork(), outbox, bus);

    const result = await uc.execute({
      fulfillmentId: f.id.toString(),
      cancelledBy: CANCELLED_BY.CUSTOMER,
      reason: 'changed my mind',
      actorId: CUSTOMER_ID,
    });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().status).toBe(FULFILLMENT_STATUS.CANCELLED);
    expect(result.getValue().cancellation).toEqual(
      expect.objectContaining({ cancelledBy: CANCELLED_BY.CUSTOMER, reason: 'changed my mind' })
    );
    expect(repo.update).toHaveBeenCalledTimes(1);
    const events = outbox.append.mock.calls[0][0];
    expect(events).toHaveLength(1);
    expect(events[0].eventName).toBe('FulfillmentCancelled');
    expect(bus.publishAll).toHaveBeenCalledTimes(1);
  });

  it('lets an admin cancel as SYSTEM without an actorId', async () => {
    const f = buildCreatedFulfillment();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const uc = new CancelFulfillment(repo, makeUnitOfWork(), makeOutbox(), makeEventBus());

    const result = await uc.execute({
      fulfillmentId: f.id.toString(),
      cancelledBy: CANCELLED_BY.SYSTEM,
      reason: 'admin override',
    });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().status).toBe(FULFILLMENT_STATUS.CANCELLED);
  });

  it('fails (no persistence) when a non-owning customer attempts to cancel', async () => {
    const f = buildCreatedFulfillment();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const outbox = makeOutbox();
    const uc = new CancelFulfillment(repo, makeUnitOfWork(), outbox, makeEventBus());

    const result = await uc.execute({
      fulfillmentId: f.id.toString(),
      cancelledBy: CANCELLED_BY.CUSTOMER,
      reason: 'not mine',
      actorId: 'someone-else',
    });

    expect(result.isFailure).toBe(true);
    expect(repo.update).not.toHaveBeenCalled();
    expect(outbox.append).not.toHaveBeenCalled();
  });

  it('returns NotFoundError for an unknown fulfillment', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const uc = new CancelFulfillment(repo, makeUnitOfWork(), makeOutbox(), makeEventBus());

    const result = await uc.execute({
      fulfillmentId: 'nope',
      cancelledBy: CANCELLED_BY.SYSTEM,
      reason: 'x',
    });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
  });
});
