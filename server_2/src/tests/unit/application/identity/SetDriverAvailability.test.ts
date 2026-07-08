import { SetDriverAvailability } from '../../../../application/identity/use-cases/SetDriverAvailability';
import { IUserRepository } from '../../../../domain/identity/repositories/IUserRepository';
import { Driver } from '../../../../domain/identity/entities/Driver';
import { Customer } from '../../../../domain/identity/entities/Customer';
import { DRIVER_STATUS } from '../../../../domain/identity/enums/driver-status.enum';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';
import { DomainError } from '../../../../domain/shared/errors/DomainError';

function makeRepo(user: unknown): jest.Mocked<IUserRepository> {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    softDelete: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockResolvedValue(user),
    findByEmail: jest.fn().mockResolvedValue(null),
    existsByEmail: jest.fn().mockResolvedValue(false),
  } as unknown as jest.Mocked<IUserRepository>;
}

function driver(opts: { status: string; available: boolean; busy?: boolean }): Driver {
  return new Driver({
    _id: 'drv-1',
    name: 'Demo Driver',
    email: 'driver@flavorstack.local',
    phone: '+919876500003',
    driverStatus: opts.status as never,
    isAvailable: opts.available,
    activeOrderId: opts.busy ? 'order-x' : null,
  } as Partial<Driver>);
}

describe('SetDriverAvailability', () => {
  it('brings a verified driver ONLINE (ACTIVE + available)', async () => {
    const repo = makeRepo(driver({ status: DRIVER_STATUS.OFFLINE, available: false }));
    const uc = new SetDriverAvailability(repo);

    const result = await uc.execute({ userId: 'drv-1', available: true });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toMatchObject({
      driverStatus: DRIVER_STATUS.ACTIVE,
      isAvailable: true,
      isOnline: true,
    });
    expect(repo.update).toHaveBeenCalledTimes(1);
  });

  it('takes an ACTIVE driver OFFLINE', async () => {
    const repo = makeRepo(driver({ status: DRIVER_STATUS.ACTIVE, available: true }));
    const uc = new SetDriverAvailability(repo);

    const result = await uc.execute({ userId: 'drv-1', available: false });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toMatchObject({ isAvailable: false, isOnline: false });
    expect(repo.update).toHaveBeenCalledTimes(1);
  });

  it('returns NotFoundError when the user does not exist', async () => {
    const repo = makeRepo(null);
    const uc = new SetDriverAvailability(repo);

    const result = await uc.execute({ userId: 'missing', available: true });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('returns ForbiddenError when the user is not a driver', async () => {
    const customer = Customer.create({ name: 'C', email: 'c@x.com', phone: '+919876500009', passwordHash: 'h' });
    const repo = makeRepo(customer);
    const uc = new SetDriverAvailability(repo);

    const result = await uc.execute({ userId: 'cust-1', available: true });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ForbiddenError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('returns ForbiddenError when an unverified driver tries to go online, without persisting', async () => {
    const repo = makeRepo(driver({ status: DRIVER_STATUS.PENDING_VERIFICATION, available: false }));
    const uc = new SetDriverAvailability(repo);

    const result = await uc.execute({ userId: 'drv-1', available: true });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ForbiddenError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('returns DomainError when a busy driver tries to go offline, without persisting', async () => {
    const repo = makeRepo(driver({ status: DRIVER_STATUS.ON_DELIVERY, available: true, busy: true }));
    const uc = new SetDriverAvailability(repo);

    const result = await uc.execute({ userId: 'drv-1', available: false });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(DomainError);
    expect(repo.update).not.toHaveBeenCalled();
  });
});
