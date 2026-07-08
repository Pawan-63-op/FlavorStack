import { MarkReadyForPickup } from '../../../../application/fulfillment/use-cases/MarkReadyForPickup';
import { IFulfillmentRepository } from '../../../../domain/fulfillment/repositories/IFulfillmentRepository';
import { IRestaurantDirectory } from '../../../../application/fulfillment/ports/IRestaurantDirectory';
import { Fulfillment } from '../../../../domain/fulfillment/entities/Fulfillment';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';
import { IUnitOfWork } from '../../../../application/shared/ports/IUnitOfWork';
import { IOutboxStore } from '../../../../application/shared/outbox/IOutboxStore';
import { IEventBus } from '../../../../application/shared/events/IEventBus';
import { FULFILLMENT_STATUS } from '../../../../domain/fulfillment/enums/fulfillment-status.enum';
import { Money } from '../../../../domain/shared/Money';
import { GeoPoint } from '../../../../domain/identity/value-objects/GeoPoint.vo';
import { FulfillmentLine } from '../../../../domain/fulfillment/value-objects/FulfillmentLine';
import { DeliveryAddress } from '../../../../domain/fulfillment/value-objects/DeliveryAddress';

function money(n: number) { return Money.create(n, 'INR').getValue(); }

const RESTAURANT_ID = 'rest-1';
const OWNER_ID = 'owner-1';

function makeDirectory(ownerId: string | null = OWNER_ID): jest.Mocked<IRestaurantDirectory> {
  return {
    getOwnerId: jest.fn().mockResolvedValue(ownerId),
    listRestaurantIdsByOwner: jest.fn().mockResolvedValue([]),
    getRestaurantNames: jest.fn().mockResolvedValue({}),
    countAll: jest.fn().mockResolvedValue(0),
  } as jest.Mocked<IRestaurantDirectory>;
}

function buildPreparingFulfillment(restaurantId = RESTAURANT_ID): Fulfillment {
  const f = Fulfillment.createFromOrderRequested({
    orderRequestId: 'order-req-1',
    customerId: 'cust-1',
    restaurantId,
    lines: [FulfillmentLine.create({ menuItemId: 'i1', name: 'X', quantity: 1, selectedOptions: [], lineTotal: money(100) }).getValue()],
    deliveryAddress: DeliveryAddress.create({ street: 'A', city: 'B', state: 'C', pinCode: '000001', coordinates: GeoPoint.create(0, 0).getValue() }).getValue(),
    pricingTotal: money(100),
  }).getValue();
  f.pullDomainEvents();
  f.startPreparation(restaurantId);
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

describe('MarkReadyForPickup', () => {
  it('updates status to READY_FOR_PICKUP, appends ReadyForPickup event, publishes', async () => {
    const fulfillment = buildPreparingFulfillment();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(fulfillment) });
    const outbox = makeOutbox();
    const bus = makeEventBus();
    const uc = new MarkReadyForPickup(repo, makeDirectory(), makeUnitOfWork(), outbox, bus);

    const result = await uc.execute({
      fulfillmentId: fulfillment.id.toString(),
      actorUserId: OWNER_ID,
    });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().status).toBe(FULFILLMENT_STATUS.READY_FOR_PICKUP);

    expect(repo.update).toHaveBeenCalledTimes(1);
    expect(outbox.append).toHaveBeenCalledTimes(1);
    const events = outbox.append.mock.calls[0][0];
    expect(events).toHaveLength(1);
    expect(events[0].eventName).toBe('ReadyForPickup');

    expect(bus.publishAll).toHaveBeenCalledTimes(1);
  });

  it('returns NotFoundError when fulfillment does not exist', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const uc = new MarkReadyForPickup(repo, makeDirectory(), makeUnitOfWork(), makeOutbox(), makeEventBus());

    const result = await uc.execute({ fulfillmentId: 'nonexistent', actorUserId: OWNER_ID });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('returns ForbiddenError when the actor is NOT the restaurant owner', async () => {
    const fulfillment = buildPreparingFulfillment();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(fulfillment) });
    const directory = makeDirectory(OWNER_ID);
    const uc = new MarkReadyForPickup(repo, directory, makeUnitOfWork(), makeOutbox(), makeEventBus());

    const result = await uc.execute({ fulfillmentId: fulfillment.id.toString(), actorUserId: 'someone-else' });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ForbiddenError);
    expect(directory.getOwnerId).toHaveBeenCalledWith(RESTAURANT_ID);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('returns failure on invalid state transition (CREATED → READY_FOR_PICKUP) without persisting', async () => {
    const f = Fulfillment.createFromOrderRequested({
      orderRequestId: 'req-2',
      customerId: 'c1',
      restaurantId: 'rest-1',
      lines: [FulfillmentLine.create({ menuItemId: 'i1', name: 'X', quantity: 1, selectedOptions: [], lineTotal: money(100) }).getValue()],
      deliveryAddress: DeliveryAddress.create({ street: 'A', city: 'B', state: 'C', pinCode: '000001', coordinates: GeoPoint.create(0, 0).getValue() }).getValue(),
      pricingTotal: money(100),
    }).getValue();
    f.pullDomainEvents();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const outbox = makeOutbox();
    const uc = new MarkReadyForPickup(repo, makeDirectory(), makeUnitOfWork(), outbox, makeEventBus());

    const result = await uc.execute({ fulfillmentId: f.id.toString(), actorUserId: OWNER_ID });

    expect(result.isFailure).toBe(true);
    expect(repo.update).not.toHaveBeenCalled();
    expect(outbox.append).not.toHaveBeenCalled();
  });
});
