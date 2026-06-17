import { MarkPreparing } from '../../../../application/fulfillment/use-cases/MarkPreparing';
import { IFulfillmentRepository } from '../../../../domain/fulfillment/repositories/IFulfillmentRepository';
import { Fulfillment } from '../../../../domain/fulfillment/entities/Fulfillment';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { IUnitOfWork } from '../../../../application/shared/ports/IUnitOfWork';
import { IOutboxStore } from '../../../../application/shared/outbox/IOutboxStore';
import { IEventBus } from '../../../../application/shared/events/IEventBus';
import { FULFILLMENT_STATUS } from '../../../../domain/fulfillment/enums/fulfillment-status.enum';
import { Money } from '../../../../domain/shared/Money';
import { GeoPoint } from '../../../../domain/identity/value-objects/GeoPoint.vo';
import { FulfillmentLine } from '../../../../domain/fulfillment/value-objects/FulfillmentLine';
import { DeliveryAddress } from '../../../../domain/fulfillment/value-objects/DeliveryAddress';

function money(n: number) { return Money.create(n, 'INR').getValue(); }

function buildCreatedFulfillment(restaurantId = 'rest-1'): Fulfillment {
  const f = Fulfillment.createFromOrderRequested({
    orderRequestId: 'order-req-1',
    customerId: 'cust-1',
    restaurantId,
    lines: [FulfillmentLine.create({ menuItemId: 'i1', name: 'X', quantity: 1, selectedOptions: [], lineTotal: money(100) }).getValue()],
    deliveryAddress: DeliveryAddress.create({ street: 'A', city: 'B', state: 'C', pinCode: '000001', coordinates: GeoPoint.create(0, 0).getValue() }).getValue(),
    pricingTotal: money(100),
  }).getValue();
  f.pullDomainEvents();
  return f;
}

function makeRepo(overrides: Partial<IFulfillmentRepository> = {}): jest.Mocked<IFulfillmentRepository> {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockResolvedValue(null),
    findByOrderRequestId: jest.fn().mockResolvedValue(null),
    findActiveByRestaurant: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as jest.Mocked<IFulfillmentRepository>;
}

function makeUnitOfWork(): IUnitOfWork {
  return { runInTransaction: jest.fn(<T>(work: (ctx: unknown) => Promise<T>) => work({})) };
}

function makeOutbox(): jest.Mocked<IOutboxStore> {
  return { append: jest.fn().mockResolvedValue(undefined) } as jest.Mocked<IOutboxStore>;
}

function makeEventBus(): jest.Mocked<IEventBus> {
  return {
    subscribe: jest.fn(),
    publish: jest.fn().mockResolvedValue(undefined),
    publishAll: jest.fn().mockResolvedValue(undefined),
  } as jest.Mocked<IEventBus>;
}

describe('MarkPreparing', () => {
  it('updates status to PREPARING, appends PreparationStarted, publishes', async () => {
    const fulfillment = buildCreatedFulfillment();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(fulfillment) });
    const outbox = makeOutbox();
    const bus = makeEventBus();
    const uc = new MarkPreparing(repo, makeUnitOfWork(), outbox, bus);

    const result = await uc.execute({
      fulfillmentId: fulfillment.id.toString(),
      restaurantId: 'rest-1',
    });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().status).toBe(FULFILLMENT_STATUS.PREPARING);

    expect(repo.update).toHaveBeenCalledTimes(1);
    expect(outbox.append).toHaveBeenCalledTimes(1);
    const events = outbox.append.mock.calls[0][0];
    expect(events).toHaveLength(1);
    expect(events[0].eventName).toBe('PreparationStarted');

    expect(bus.publishAll).toHaveBeenCalledTimes(1);
  });

  it('carries prepEstimateMinutes in the response', async () => {
    const fulfillment = buildCreatedFulfillment();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(fulfillment) });
    const uc = new MarkPreparing(repo, makeUnitOfWork(), makeOutbox(), makeEventBus());

    const result = await uc.execute({
      fulfillmentId: fulfillment.id.toString(),
      restaurantId: 'rest-1',
      prepEstimateMinutes: 30,
    });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().prepEstimateMinutes).toBe(30);
  });

  it('returns NotFoundError when fulfillment does not exist', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const uc = new MarkPreparing(repo, makeUnitOfWork(), makeOutbox(), makeEventBus());

    const result = await uc.execute({ fulfillmentId: 'nonexistent', restaurantId: 'rest-1' });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('returns ForbiddenError when restaurantId does not own the fulfillment', async () => {
    const fulfillment = buildCreatedFulfillment('rest-1');
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(fulfillment) });
    const uc = new MarkPreparing(repo, makeUnitOfWork(), makeOutbox(), makeEventBus());

    const result = await uc.execute({ fulfillmentId: fulfillment.id.toString(), restaurantId: 'wrong-rest' });

    expect(result.isFailure).toBe(true);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('returns failure on illegal state transition without persisting', async () => {
    const fulfillment = buildCreatedFulfillment();
    fulfillment.startPreparation('rest-1');
    fulfillment.pullDomainEvents(); // already PREPARING
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(fulfillment) });
    const outbox = makeOutbox();
    const uc = new MarkPreparing(repo, makeUnitOfWork(), outbox, makeEventBus());

    const result = await uc.execute({ fulfillmentId: fulfillment.id.toString(), restaurantId: 'rest-1' });

    expect(result.isFailure).toBe(true);
    expect(repo.update).not.toHaveBeenCalled();
    expect(outbox.append).not.toHaveBeenCalled();
  });
});
