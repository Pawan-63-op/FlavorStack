import { createAvailableDriversProvider } from '../../../infrastructure/services/AvailableDriversProvider';
import { IDriverRepository } from '../../../domain/identity/repositories/IDriverRepository';
import { Driver } from '../../../domain/identity/entities/Driver';
import { DRIVER_STATUS } from '../../../domain/identity/enums/driver-status.enum';

function driver(id: string, opts: { available: boolean; status: string; busy?: boolean }): Driver {
  return new Driver({
    _id: id,
    name: `Driver ${id}`,
    email: `${id}@flavorstack.local`,
    phone: '+919876500000',
    isAvailable: opts.available,
    driverStatus: opts.status as never,
    activeOrderId: opts.busy ? 'order-x' : null,
  } as Partial<Driver>);
}

function makeRepo(drivers: Driver[]): jest.Mocked<IDriverRepository> {
  return {
    findNearby: jest.fn().mockResolvedValue([]),
    findAvailable: jest.fn().mockResolvedValue(drivers),
    findByStatus: jest.fn().mockResolvedValue([]),
  } as jest.Mocked<IDriverRepository>;
}

describe('createAvailableDriversProvider', () => {
  it('returns ids of online, non-busy drivers', async () => {
    const repo = makeRepo([
      driver('rider-online', { available: true, status: DRIVER_STATUS.ACTIVE }),
    ]);
    const provider = createAvailableDriversProvider(repo);

    const ids = await provider('rest-1');

    expect(ids).toEqual(['rider-online']);
  });

  it('excludes drivers that are not online (available but not ACTIVE)', async () => {
    const repo = makeRepo([
      driver('rider-offline', { available: true, status: DRIVER_STATUS.OFFLINE }),
      driver('rider-online', { available: true, status: DRIVER_STATUS.ACTIVE }),
    ]);
    const provider = createAvailableDriversProvider(repo);

    const ids = await provider('rest-1');

    expect(ids).toEqual(['rider-online']);
  });

  it('excludes busy drivers (already on a delivery)', async () => {
    const repo = makeRepo([
      driver('rider-busy', { available: true, status: DRIVER_STATUS.ON_DELIVERY, busy: true }),
      driver('rider-free', { available: true, status: DRIVER_STATUS.ACTIVE }),
    ]);
    const provider = createAvailableDriversProvider(repo);

    const ids = await provider('rest-1');

    expect(ids).toEqual(['rider-free']);
  });

  it('returns an empty list when the repository has no available drivers', async () => {
    const repo = makeRepo([]);
    const provider = createAvailableDriversProvider(repo);

    expect(await provider('rest-1')).toEqual([]);
  });
});
