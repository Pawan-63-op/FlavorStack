import { VerifyDriver } from '../../../../application/identity/use-cases/VerifyDriver';
import {
  InMemoryUserRepository,
  InMemoryUnitOfWork,
} from '../../../mocks/identity.mocks';
import { createEventBusSpy, EventBusSpy } from '../../../mocks/shared.mocks';
import { Driver } from '../../../../domain/identity/entities/Driver';
import { Customer } from '../../../../domain/identity/entities/Customer';
import { DRIVER_STATUS } from '../../../../domain/identity/enums/driver-status.enum';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';
import { ConflictError } from '../../../../domain/shared/errors/ConflictError';

function driver(status: string): Driver {
  return new Driver({
    _id: 'drv-1',
    name: 'Demo Driver',
    email: 'driver@flavorstack.local',
    phone: '+919876500003',
    driverStatus: status as never,
    isAvailable: false,
    activeOrderId: null,
  } as Partial<Driver>);
}

describe('VerifyDriver use-case', () => {
  let userRepo: InMemoryUserRepository;
  let unitOfWork: InMemoryUnitOfWork;
  let eventBus: EventBusSpy;
  let useCase: VerifyDriver;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    unitOfWork = new InMemoryUnitOfWork();
    eventBus = createEventBusSpy();
    useCase = new VerifyDriver(userRepo, unitOfWork, eventBus);
  });

  it('verifies a PENDING driver → OFFLINE and persists, raising no domain event', async () => {
    await userRepo.save(driver(DRIVER_STATUS.PENDING_VERIFICATION));

    const result = await useCase.execute({ driverId: 'drv-1' });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toMatchObject({
      driverStatus: DRIVER_STATUS.OFFLINE,
      isAvailable: false,
      isOnline: false,
    });
    // Phase 6: verification raises no domain event — it had no subscriber.
    expect(eventBus.publishedEvents).toHaveLength(0);
    expect(eventBus.publishedEvents).toHaveLength(0);
  });

  it('re-verifies a SUSPENDED driver → OFFLINE (domain allows re-verification)', async () => {
    await userRepo.save(driver(DRIVER_STATUS.SUSPENDED));

    const result = await useCase.execute({ driverId: 'drv-1' });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().driverStatus).toBe(DRIVER_STATUS.OFFLINE);
    expect(eventBus.publishedEvents).toHaveLength(0);
  });

  it('returns NotFoundError when the user does not exist, without persisting', async () => {
    const result = await useCase.execute({ driverId: 'missing' });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
    expect(eventBus.publishedEvents).toHaveLength(0);
  });

  it('returns ForbiddenError when the target is not a driver, without persisting', async () => {
    const customer = Customer.create({
      name: 'C',
      email: 'c@x.com',
      phone: '+919876500009',
      passwordHash: 'h',
    });
    customer.pullDomainEvents();
    await userRepo.save(customer);

    const result = await useCase.execute({ driverId: customer._id });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ForbiddenError);
    expect(eventBus.publishedEvents).toHaveLength(0);
  });

  it('returns ConflictError when the driver is already verified, without persisting or emitting', async () => {
    await userRepo.save(driver(DRIVER_STATUS.OFFLINE));

    const result = await useCase.execute({ driverId: 'drv-1' });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ConflictError);
    expect(eventBus.publishedEvents).toHaveLength(0);
    expect(eventBus.publishedEvents).toHaveLength(0);
  });
});
