import { CreateFulfillment } from '../../../../application/fulfillment/use-cases/CreateFulfillment';
import { CreateFulfillmentDto } from '../../../../application/fulfillment/dtos/CreateFulfillmentDto';
import { IFulfillmentRepository } from '../../../../domain/fulfillment/repositories/IFulfillmentRepository';
import { Fulfillment } from '../../../../domain/fulfillment/entities/Fulfillment';
import { ConflictError } from '../../../../domain/shared/errors/ConflictError';
import { IUnitOfWork } from '../../../../application/shared/ports/IUnitOfWork';
import { IOutboxStore } from '../../../../application/shared/outbox/IOutboxStore';
import { IEventBus } from '../../../../application/shared/events/IEventBus';

function validDto(overrides: Partial<CreateFulfillmentDto> = {}): CreateFulfillmentDto {
  return {
    orderRequestId: 'order-req-1',
    customerId: 'cust-1',
    restaurantId: 'rest-1',
    lines: [
      {
        menuItemId: 'item-1',
        name: 'Paneer Tikka',
        quantity: 2,
        selectedOptions: [{ optionId: 'opt-1', label: 'Extra spicy', priceDelta: { amount: 0, currency: 'INR' } }],
        lineTotal: { amount: 40000, currency: 'INR' },
      },
    ],
    deliveryAddress: {
      label: 'Home',
      street: '12 MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pinCode: '560001',
      coordinates: { lat: 12.97, lng: 77.59 },
    },
    total: { amount: 45000, currency: 'INR' },
    ...overrides,
  };
}

function makeRepo(overrides: Partial<IFulfillmentRepository> = {}): jest.Mocked<IFulfillmentRepository> {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockResolvedValue(null),
    findByOrderRequestId: jest.fn().mockResolvedValue(null),
    ...overrides,
  } as jest.Mocked<IFulfillmentRepository>;
}

function makeUnitOfWork(): IUnitOfWork {
  return {
    runInTransaction: jest.fn(<T>(work: (ctx: unknown) => Promise<T>) => work({})),
  };
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

describe('CreateFulfillment', () => {
  it('persists the fulfillment, appends its events, and publishes them', async () => {
    const repo = makeRepo();
    const uow = makeUnitOfWork();
    const outbox = makeOutbox();
    const bus = makeEventBus();
    const uc = new CreateFulfillment(repo, uow, outbox, bus);

    const result = await uc.execute(validDto());

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().status).toBe('CREATED');
    expect(result.getValue().orderRequestId).toBe('order-req-1');

    expect(repo.save).toHaveBeenCalledTimes(1);
    const saved = repo.save.mock.calls[0][0] as Fulfillment;
    expect(saved.orderRequestId).toBe('order-req-1');

    expect(outbox.append).toHaveBeenCalledTimes(1);
    const appendedEvents = outbox.append.mock.calls[0][0];
    expect(appendedEvents).toHaveLength(1);
    expect(appendedEvents[0].eventName).toBe('FulfillmentCreated');

    expect(bus.publishAll).toHaveBeenCalledTimes(1);
  });

  it('is an idempotent no-op when the orderRequestId already exists', async () => {
    const repo = makeRepo({
      findByOrderRequestId: jest.fn().mockResolvedValue(buildExisting()),
    });
    const outbox = makeOutbox();
    const bus = makeEventBus();
    const uc = new CreateFulfillment(repo, makeUnitOfWork(), outbox, bus);

    const result = await uc.execute(validDto());

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().orderRequestId).toBe('order-req-1');
    expect(repo.save).not.toHaveBeenCalled();
    expect(outbox.append).not.toHaveBeenCalled();
    expect(bus.publishAll).not.toHaveBeenCalled();
  });

  it('resolves a concurrent ConflictError by returning the winner', async () => {
    const winner = buildExisting();
    const findByOrderRequestId = jest
      .fn()
      .mockResolvedValueOnce(null) // pre-check: nothing yet
      .mockResolvedValueOnce(winner); // post-conflict re-read: the racer's row
    const repo = makeRepo({
      findByOrderRequestId,
      save: jest.fn().mockRejectedValue(new ConflictError('dup')),
    });
    const uow = makeUnitOfWork();
    const bus = makeEventBus();
    const uc = new CreateFulfillment(repo, uow, makeOutbox(), bus);

    const result = await uc.execute(validDto());

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().fulfillmentId).toBe(winner.id.toString());
    expect(bus.publishAll).not.toHaveBeenCalled();
  });

  it('fails validation on a malformed line without persisting', async () => {
    const repo = makeRepo();
    const uc = new CreateFulfillment(repo, makeUnitOfWork(), makeOutbox(), makeEventBus());

    const result = await uc.execute(
      validDto({
        lines: [
          {
            menuItemId: 'item-1',
            name: 'Bad',
            quantity: 0, // invalid
            selectedOptions: [],
            lineTotal: { amount: 100, currency: 'INR' },
          },
        ],
      })
    );

    expect(result.isFailure).toBe(true);
    expect(repo.save).not.toHaveBeenCalled();
  });
});

function buildExisting(): Fulfillment {
  const { Money } = require('../../../../domain/shared/Money');
  const { GeoPoint } = require('../../../../domain/identity/value-objects/GeoPoint.vo');
  const { DeliveryAddress } = require('../../../../domain/fulfillment/value-objects/DeliveryAddress');
  const { FulfillmentLine } = require('../../../../domain/fulfillment/value-objects/FulfillmentLine');

  const line = FulfillmentLine.create({
    menuItemId: 'item-1',
    name: 'Paneer Tikka',
    quantity: 1,
    selectedOptions: [],
    lineTotal: Money.create(45000, 'INR').getValue(),
  }).getValue();
  const address = DeliveryAddress.create({
    street: '12 MG Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    pinCode: '560001',
    coordinates: GeoPoint.create(12.97, 77.59).getValue(),
  }).getValue();

  const f = Fulfillment.createFromOrderRequested({
    orderRequestId: 'order-req-1',
    customerId: 'cust-1',
    restaurantId: 'rest-1',
    lines: [line],
    deliveryAddress: address,
    pricingTotal: Money.create(45000, 'INR').getValue(),
  }).getValue();
  f.pullDomainEvents();
  return f;
}
