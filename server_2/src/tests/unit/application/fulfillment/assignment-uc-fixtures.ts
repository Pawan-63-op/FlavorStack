import { Fulfillment } from '../../../../domain/fulfillment/entities/Fulfillment';
import { FulfillmentLine } from '../../../../domain/fulfillment/value-objects/FulfillmentLine';
import { DeliveryAddress } from '../../../../domain/fulfillment/value-objects/DeliveryAddress';
import { IFulfillmentRepository } from '../../../../domain/fulfillment/repositories/IFulfillmentRepository';
import { IDeliveryAssignmentService } from '../../../../domain/fulfillment/services/IDeliveryAssignmentService';
import { IUnitOfWork } from '../../../../application/shared/ports/IUnitOfWork';
import { IEventBus } from '../../../../application/shared/events/IEventBus';
import { Money } from '../../../../domain/shared/Money';
import { GeoPoint } from '../../../../domain/identity/value-objects/GeoPoint.vo';

export function money(n: number): Money {
  return Money.create(n, 'INR').getValue();
}

/** A fulfillment sitting at READY_FOR_PICKUP (the realistic point where assignment begins). */
export function buildReadyFulfillment(restaurantId = 'rest-1'): Fulfillment {
  const f = Fulfillment.createFromOrderRequested({
    orderRequestId: 'order-req-1',
    customerId: 'cust-1',
    restaurantId,
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
  f.startPreparation(restaurantId);
  f.markReadyForPickup(restaurantId);
  f.pullDomainEvents();
  return f;
}

export function makeRepo(overrides: Partial<IFulfillmentRepository> = {}): jest.Mocked<IFulfillmentRepository> {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockResolvedValue(null),
    findByOrderRequestId: jest.fn().mockResolvedValue(null),
    findActiveByRestaurant: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as jest.Mocked<IFulfillmentRepository>;
}

export function makeUnitOfWork(): IUnitOfWork {
  return { runInTransaction: jest.fn(<T>(work: (ctx: unknown) => Promise<T>) => work({})) };
}

export function makeEventBus(): jest.Mocked<IEventBus> {
  return {
    subscribe: jest.fn(),
    publish: jest.fn().mockResolvedValue(undefined),
    publishAll: jest.fn().mockResolvedValue(undefined),
  } as jest.Mocked<IEventBus>;
}

/**
 * `assignable` controls the explicit-riderId path: `AssignRider`/`ReassignRider` now verify an
 * admin-named rider through `isRiderAssignable` before offering to them.
 */
export function makeAssignmentService(
  riderId: string | null,
  assignable = true
): jest.Mocked<IDeliveryAssignmentService> {
  return {
    pickNextRider: jest.fn().mockResolvedValue(riderId),
    isRiderAssignable: jest.fn().mockResolvedValue(assignable),
  } as jest.Mocked<IDeliveryAssignmentService>;
}
