import { Driver } from '../../../../domain/identity/entities/Driver';
import { DRIVER_STATUS } from '../../../../domain/identity/enums/driver-status.enum';
import { USER_ROLE } from '../../../../domain/identity/enums/user-role.enum';
import { UserRegistered } from '../../../../domain/identity/events/UserRegistered';
import { DriverVerified } from '../../../../domain/identity/events/DriverVerified';
import { DriverSuspended } from '../../../../domain/identity/events/DriverSuspended';
import { DomainError } from '../../../../domain/shared/errors/DomainError';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';
import { VehicleInfo } from '../../../../domain/identity/value-objects/VehicleInfo.vo';

describe('Driver Entity', () => {
  const mockVehicle = VehicleInfo.create({
    type: 'Bike',
    brand: 'Honda',
    model: 'Activa',
    licensePlate: 'MH-12-AB-1234',
    rcDocumentUrl: 'https://example.com/rc-doc.pdf',
    insuranceUrl: 'https://example.com/insurance-doc.pdf',
  }).getValue();

  const validDriverInput = {
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    phone: '+919876543211',
    passwordHash: 'hashedpassword123',
    vehicle: mockVehicle,
  };

  describe('creation', () => {
    it('should create a pending driver, initialize default values, and record UserRegistered event', () => {
      const driver = Driver.create(validDriverInput);

      expect(driver).toBeDefined();
      expect(driver.name).toBe(validDriverInput.name);
      expect(driver.email).toBe(validDriverInput.email);
      expect(driver.role).toBe(USER_ROLE.DRIVER);
      expect(driver.driverStatus).toBe(DRIVER_STATUS.PENDING_VERIFICATION);
      expect(driver.isAvailable).toBe(false);
      expect(driver.isVerified).toBe(false);
      expect(driver.isOnline).toBe(false);
      expect(driver.totalEarnings).toBe(0);
      expect(driver.pendingPayout).toBe(0);
      expect(driver.averageRating).toBe(0);
      expect(driver.totalDeliveries).toBe(0);
      expect(driver.totalRatings).toBe(0);

      const events = driver.pullDomainEvents();
      expect(events.length).toBe(1);
      const event = events[0] as UserRegistered;
      expect(event).toBeInstanceOf(UserRegistered);
      expect(event.eventName).toBe('UserRegistered');
      expect(event.aggregateId).toBe(driver._id);
      expect(event.role).toBe(USER_ROLE.DRIVER);
    });
  });

  describe('verification and suspension', () => {
    it('should verify driver and transition status PENDING_VERIFICATION -> OFFLINE raising DriverVerified event', () => {
      const driver = Driver.create(validDriverInput);
      driver.clearDomainEvents(); // Clear registration event

      driver.verifyDriver();

      expect(driver.driverStatus).toBe(DRIVER_STATUS.OFFLINE);
      expect(driver.isVerified).toBe(true);

      const events = driver.pullDomainEvents();
      expect(events.length).toBe(1);
      const event = events[0] as DriverVerified;
      expect(event).toBeInstanceOf(DriverVerified);
      expect(event.aggregateId).toBe(driver._id);
      expect(event.eventName).toBe('DriverVerified');
    });

    it('should suspend driver and set isAvailable to false, raising DriverSuspended event', () => {
      const driver = Driver.create(validDriverInput);
      driver.verifyDriver();
      driver.goOnline();
      driver.clearDomainEvents();

      driver.suspendDriver('Failed background check');

      expect(driver.driverStatus).toBe(DRIVER_STATUS.SUSPENDED);
      expect(driver.isAvailable).toBe(false);
      expect(driver.isVerified).toBe(false);

      const events = driver.pullDomainEvents();
      expect(events.length).toBe(1);
      const event = events[0] as DriverSuspended;
      expect(event).toBeInstanceOf(DriverSuspended);
      expect(event.aggregateId).toBe(driver._id);
      expect(event.reason).toBe('Failed background check');
      expect(event.eventName).toBe('DriverSuspended');
    });
  });

  describe('availability transitions', () => {
    it('should throw ForbiddenError when unverified driver tries to go online', () => {
      const driver = Driver.create(validDriverInput);

      expect(() => {
        driver.goOnline();
      }).toThrow(ForbiddenError);
    });

    it('should transition verified driver OFFLINE -> ACTIVE when going online', () => {
      const driver = Driver.create(validDriverInput);
      driver.verifyDriver(); // Status becomes OFFLINE

      driver.goOnline();

      expect(driver.isAvailable).toBe(true);
      expect(driver.driverStatus).toBe(DRIVER_STATUS.ACTIVE);
      expect(driver.isOnline).toBe(true);
    });

    it('should transition ACTIVE -> OFFLINE when going offline while not busy', () => {
      const driver = Driver.create(validDriverInput);
      driver.verifyDriver();
      driver.goOnline();

      driver.goOffline();

      expect(driver.isAvailable).toBe(false);
      expect(driver.driverStatus).toBe(DRIVER_STATUS.OFFLINE);
      expect(driver.isOnline).toBe(false);
    });

    it('should throw DomainError("driver_busy_cannot_go_offline") when trying to go offline while busy', () => {
      const driver = Driver.create(validDriverInput);
      driver.verifyDriver();
      driver.goOnline();
      driver.assignOrder('order-123'); // status becomes ON_DELIVERY

      expect(() => {
        driver.goOffline();
      }).toThrow(DomainError);

      try {
        driver.goOffline();
      } catch (err: any) {
        expect(err.message).toBe('driver_busy_cannot_go_offline');
      }

      expect(driver.driverStatus).toBe(DRIVER_STATUS.ON_DELIVERY); // remains busy/on delivery
    });
  });

  describe('order lifecycle', () => {
    it('should assign order when driver is online and not busy', () => {
      const driver = Driver.create(validDriverInput);
      driver.verifyDriver();
      driver.goOnline();

      driver.assignOrder('order-456');

      expect(driver.activeOrderId).toBe('order-456');
      expect(driver.driverStatus).toBe(DRIVER_STATUS.ON_DELIVERY);
      expect(driver.isBusy).toBe(true);
    });

    it('should throw DomainError("driver_not_online") when assigning order to offline driver', () => {
      const driver = Driver.create(validDriverInput);
      driver.verifyDriver(); // status is OFFLINE

      expect(() => {
        driver.assignOrder('order-456');
      }).toThrow(DomainError);

      try {
        driver.assignOrder('order-456');
      } catch (err: any) {
        expect(err.message).toBe('driver_not_online');
      }
    });

    it('should throw DomainError("driver_already_busy") when assigning order to a busy driver', () => {
      const driver = Driver.create(validDriverInput);
      driver.verifyDriver();
      driver.goOnline();
      driver.assignOrder('order-456');

      expect(() => {
        driver.assignOrder('order-789');
      }).toThrow(DomainError);

      try {
        driver.assignOrder('order-789');
      } catch (err: any) {
        expect(err.message).toBe('driver_already_busy');
      }
    });
  });

  describe('earnings and ratings', () => {
    it('should credit earnings correctly', () => {
      const driver = Driver.create(validDriverInput);

      driver.creditEarnings(25000); // ₹250.00
      expect(driver.totalEarnings).toBe(25000);
      expect(driver.pendingPayout).toBe(25000);
    });

    it('should throw ValidationError on zero or negative earnings credit', () => {
      const driver = Driver.create(validDriverInput);

      expect(() => {
        driver.creditEarnings(0);
      }).toThrow(ValidationError);

      expect(() => {
        driver.creditEarnings(-100);
      }).toThrow(ValidationError);

      expect(driver.totalEarnings).toBe(0);
    });

    it('should calculate average rating correctly', () => {
      const driver = Driver.create(validDriverInput);

      driver.receiveRating(4);
      expect(driver.averageRating).toBe(4);
      expect(driver.totalRatings).toBe(1);

      driver.receiveRating(5);
      expect(driver.averageRating).toBe(4.5);
      expect(driver.totalRatings).toBe(2);
    });

    it('should throw ValidationError on out-of-bounds ratings', () => {
      const driver = Driver.create(validDriverInput);

      expect(() => {
        driver.receiveRating(0);
      }).toThrow(ValidationError);

      expect(() => {
        driver.receiveRating(6);
      }).toThrow(ValidationError);

      expect(driver.totalRatings).toBe(0);
    });
  });
});
