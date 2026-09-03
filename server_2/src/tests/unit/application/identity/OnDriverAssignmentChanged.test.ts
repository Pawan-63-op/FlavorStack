import { OnDriverAssignmentChanged } from '../../../../application/identity/event-handlers/OnDriverAssignmentChanged';
import { InMemoryUserRepository } from '../../../mocks/identity.mocks';
import { IDriverRepository } from '../../../../domain/identity/repositories/IDriverRepository';
import { Driver } from '../../../../domain/identity/entities/Driver';
import { Customer } from '../../../../domain/identity/entities/Customer';
import { DRIVER_STATUS } from '../../../../domain/identity/enums/driver-status.enum';
import { DomainEvent } from '../../../../domain/shared/DomainEvent';

const RIDER_ID = 'rider-1';
const OTHER_RIDER_ID = 'rider-2';
const FULFILLMENT_ID = 'ful-1';

function onlineDriver(id = RIDER_ID): Driver {
  return new Driver({
    _id: id,
    name: `Driver ${id}`,
    email: `${id}@flavorstack.local`,
    phone: '+919876500000',
    isAvailable: true,
    driverStatus: DRIVER_STATUS.ACTIVE,
    activeOrderId: null,
  } as Partial<Driver>);
}

function event(eventName: string, payload: Record<string, unknown> = {}): DomainEvent {
  return {
    eventId: `evt-${eventName}`,
    occurredOn: new Date(),
    eventName,
    aggregateId: FULFILLMENT_ID,
    ...payload,
  } as unknown as DomainEvent;
}

describe('OnDriverAssignmentChanged', () => {
  let userRepo: InMemoryUserRepository;
  let driverRepo: jest.Mocked<IDriverRepository>;
  let handler: OnDriverAssignmentChanged;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    driverRepo = {
      findNearby: jest.fn().mockResolvedValue([]),
      findAvailable: jest.fn().mockResolvedValue([]),
      findByActiveOrder: jest.fn().mockResolvedValue(null),
      findByStatus: jest.fn().mockResolvedValue([]),
    } as jest.Mocked<IDriverRepository>;
    handler = new OnDriverAssignmentChanged(userRepo, driverRepo);
  });

  async function seedBusyDriver(id = RIDER_ID): Promise<Driver> {
    const driver = onlineDriver(id);
    driver.assignOrder(FULFILLMENT_ID);
    await userRepo.save(driver);
    driverRepo.findByActiveOrder.mockResolvedValue(driver);
    return driver;
  }

  describe('RiderAssigned → busy', () => {
    it('marks the rider busy with this fulfillment', async () => {
      const driver = onlineDriver();
      await userRepo.save(driver);

      await handler.onAssigned(event('RiderAssigned', { riderId: RIDER_ID }));

      expect(driver.isBusy).toBe(true);
      expect(driver.getActiveOrder()).toBe(FULFILLMENT_ID);
      expect(driver.driverStatus).toBe(DRIVER_STATUS.ON_DELIVERY);
    });

    it('is a no-op on replay (already holding this order)', async () => {
      const driver = await seedBusyDriver();
      const update = jest.spyOn(userRepo, 'update');

      await handler.onAssigned(event('RiderAssigned', { riderId: RIDER_ID }));

      expect(driver.getActiveOrder()).toBe(FULFILLMENT_ID);
      expect(update).not.toHaveBeenCalled();
    });

    it('swallows the refusal when the rider is already on a different order', async () => {
      const driver = onlineDriver();
      driver.assignOrder('another-fulfillment');
      await userRepo.save(driver);

      await expect(handler.onAssigned(event('RiderAssigned', { riderId: RIDER_ID }))).resolves.toBeUndefined();
      expect(driver.getActiveOrder()).toBe('another-fulfillment');
    });

    it('skips a userId that is not a driver', async () => {
      const customer = Customer.create({
        name: 'Not A Driver',
        email: 'c@example.com',
        phone: '+919876500001',
        passwordHash: 'hashed:Password1!',
        referralCode: 'REF00001',
      });
      customer.pullDomainEvents();
      await userRepo.save(customer);

      await expect(
        handler.onAssigned(event('RiderAssigned', { riderId: customer._id }))
      ).resolves.toBeUndefined();
    });
  });

  describe('DeliveryCompleted → free + credited', () => {
    it('frees the rider and increments totalDeliveries', async () => {
      const driver = await seedBusyDriver();
      const before = driver.totalDeliveries;

      await handler.onCompleted(event('DeliveryCompleted', { riderId: RIDER_ID }));

      expect(driver.isBusy).toBe(false);
      expect(driver.driverStatus).toBe(DRIVER_STATUS.ACTIVE);
      expect(driver.totalDeliveries).toBe(before + 1);
    });

    it('ignores a completion for an order the rider is not holding', async () => {
      const driver = onlineDriver();
      driver.assignOrder('another-fulfillment');
      await userRepo.save(driver);

      await handler.onCompleted(event('DeliveryCompleted', { riderId: RIDER_ID }));

      expect(driver.getActiveOrder()).toBe('another-fulfillment');
      expect(driver.totalDeliveries).toBe(0);
    });
  });

  describe('release without credit', () => {
    it('frees the rider named by DeliveryFailed, leaving totalDeliveries alone', async () => {
      const driver = await seedBusyDriver();

      await handler.onReleased(event('DeliveryFailed', { riderId: RIDER_ID }));

      expect(driver.isBusy).toBe(false);
      expect(driver.totalDeliveries).toBe(0);
    });

    it('resolves the rider by active order when the event names none (FulfillmentCancelled)', async () => {
      const driver = await seedBusyDriver();

      await handler.onReleased(event('FulfillmentCancelled', { cancelledBy: 'CUSTOMER' }));

      expect(driverRepo.findByActiveOrder).toHaveBeenCalledWith(FULFILLMENT_ID);
      expect(driver.isBusy).toBe(false);
    });

    it('frees the *previous* rider on RiderReassigned, not the new one', async () => {
      const previous = await seedBusyDriver(RIDER_ID);
      const next = onlineDriver(OTHER_RIDER_ID);
      await userRepo.save(next);

      await handler.onReleased(
        event('RiderReassigned', { previousRiderId: RIDER_ID, newRiderId: OTHER_RIDER_ID })
      );

      expect(previous.isBusy).toBe(false);
      expect(next.isBusy).toBe(false); // RiderAssigned, published next, is what makes them busy
      expect(previous.totalDeliveries).toBe(0);
    });

    it('does nothing when no driver holds the order', async () => {
      await expect(
        handler.onReleased(event('FulfillmentCancelled', { cancelledBy: 'SYSTEM' }))
      ).resolves.toBeUndefined();
    });
  });
});
