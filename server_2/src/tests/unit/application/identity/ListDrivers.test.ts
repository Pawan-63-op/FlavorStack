import { ListDrivers } from '../../../../application/identity/use-cases/ListDrivers';
import { IDriverRepository } from '../../../../domain/identity/repositories/IDriverRepository';
import { Driver } from '../../../../domain/identity/entities/Driver';
import { DriverStatus, DRIVER_STATUS } from '../../../../domain/identity/enums/driver-status.enum';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';

function driver(id: string, status: string): Driver {
  return new Driver({
    _id: id,
    name: 'Demo Driver',
    email: `${id}@flavorstack.local`,
    phone: '+919876500003',
    driverStatus: status as never,
    isAvailable: false,
    activeOrderId: null,
    createdAt: new Date('2026-06-28T00:00:00Z'),
    vehicle: {
      type: 'BIKE',
      brand: 'Honda',
      model: 'Activa',
      licensePlate: 'KA01AB1234',
      rcDocumentUrl: 'https://x/rc',
      insuranceUrl: 'https://x/ins',
    } as never,
  } as Partial<Driver>);
}

class FakeDriverRepository implements IDriverRepository {
  public lastStatus: DriverStatus | undefined;
  constructor(private readonly drivers: Driver[]) {}
  findNearby(): Promise<Driver[]> {
    return Promise.resolve([]);
  }
  findAvailable(): Promise<Driver[]> {
    return Promise.resolve([]);
  }
  findByStatus(status?: DriverStatus): Promise<Driver[]> {
    this.lastStatus = status;
    const list = status ? this.drivers.filter((d) => d.driverStatus === status) : this.drivers;
    return Promise.resolve(list);
  }
}

describe('ListDrivers use-case', () => {
  it('returns a driver summary list (no status filter passes undefined to the repo)', async () => {
    const repo = new FakeDriverRepository([driver('drv-1', DRIVER_STATUS.PENDING_VERIFICATION)]);
    const useCase = new ListDrivers(repo);

    const result = await useCase.execute({});

    expect(result.isSuccess).toBe(true);
    expect(repo.lastStatus).toBeUndefined();
    expect(result.getValue().drivers).toEqual([
      {
        id: 'drv-1',
        name: 'Demo Driver',
        email: 'drv-1@flavorstack.local',
        phone: '+919876500003',
        driverStatus: DRIVER_STATUS.PENDING_VERIFICATION,
        isVerified: false,
        vehicle: { type: 'BIKE', brand: 'Honda', model: 'Activa', licensePlate: 'KA01AB1234' },
        createdAt: new Date('2026-06-28T00:00:00Z'),
      },
    ]);
  });

  it('forwards a valid status filter to the repository', async () => {
    const repo = new FakeDriverRepository([
      driver('drv-1', DRIVER_STATUS.PENDING_VERIFICATION),
      driver('drv-2', DRIVER_STATUS.OFFLINE),
    ]);
    const useCase = new ListDrivers(repo);

    const result = await useCase.execute({ status: DRIVER_STATUS.PENDING_VERIFICATION });

    expect(repo.lastStatus).toBe(DRIVER_STATUS.PENDING_VERIFICATION);
    expect(result.getValue().drivers.map((d) => d.id)).toEqual(['drv-1']);
  });

  it('rejects an unknown status with a ValidationError', async () => {
    const repo = new FakeDriverRepository([]);
    const useCase = new ListDrivers(repo);

    const result = await useCase.execute({ status: 'NOT_A_STATUS' });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });
});
