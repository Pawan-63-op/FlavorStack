import { createAvailableDriversProvider } from '../../../infrastructure/services/AvailableDriversProvider';
import { IDriverRepository } from '../../../domain/identity/repositories/IDriverRepository';
import { Driver } from '../../../domain/identity/entities/Driver';
import { DRIVER_STATUS } from '../../../domain/identity/enums/driver-status.enum';
import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';

const RESTAURANT_POINT = GeoPoint.create(12.97, 77.59).getValue();
const RADIUS = 8000;

/** Default locator: the restaurant has no known location, so the provider uses the global list. */
const noLocation = async (): Promise<GeoPoint | null> => null;

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
    findByActiveOrder: jest.fn().mockResolvedValue(null),
    findByStatus: jest.fn().mockResolvedValue([]),
  } as jest.Mocked<IDriverRepository>;
}

describe('createAvailableDriversProvider', () => {
  it('returns ids of online, non-busy drivers', async () => {
    const repo = makeRepo([
      driver('rider-online', { available: true, status: DRIVER_STATUS.ACTIVE }),
    ]);
    const provider = createAvailableDriversProvider(repo, noLocation, RADIUS);

    const ids = await provider('rest-1');

    expect(ids).toEqual(['rider-online']);
  });

  it('excludes drivers that are not online (available but not ACTIVE)', async () => {
    const repo = makeRepo([
      driver('rider-offline', { available: true, status: DRIVER_STATUS.OFFLINE }),
      driver('rider-online', { available: true, status: DRIVER_STATUS.ACTIVE }),
    ]);
    const provider = createAvailableDriversProvider(repo, noLocation, RADIUS);

    const ids = await provider('rest-1');

    expect(ids).toEqual(['rider-online']);
  });

  it('excludes busy drivers (already on a delivery)', async () => {
    const repo = makeRepo([
      driver('rider-busy', { available: true, status: DRIVER_STATUS.ON_DELIVERY, busy: true }),
      driver('rider-free', { available: true, status: DRIVER_STATUS.ACTIVE }),
    ]);
    const provider = createAvailableDriversProvider(repo, noLocation, RADIUS);

    const ids = await provider('rest-1');

    expect(ids).toEqual(['rider-free']);
  });

  it('returns an empty list when the repository has no available drivers', async () => {
    const repo = makeRepo([]);
    const provider = createAvailableDriversProvider(repo, noLocation, RADIUS);

    expect(await provider('rest-1')).toEqual([]);
  });

  describe('proximity to the restaurant', () => {
    it('prefers riders near the restaurant, in the order findNearby returns them', async () => {
      const near = [
        driver('rider-near', { available: true, status: DRIVER_STATUS.ACTIVE }),
        driver('rider-far', { available: true, status: DRIVER_STATUS.ACTIVE }),
      ];
      const repo = makeRepo([driver('rider-global', { available: true, status: DRIVER_STATUS.ACTIVE })]);
      repo.findNearby.mockResolvedValue(near);

      const provider = createAvailableDriversProvider(repo, async () => RESTAURANT_POINT, RADIUS);
      const ids = await provider('rest-1');

      expect(repo.findNearby).toHaveBeenCalledWith(RESTAURANT_POINT, RADIUS);
      expect(ids).toEqual(['rider-near', 'rider-far']);
      expect(repo.findAvailable).not.toHaveBeenCalled();
    });

    it('still filters the nearby list by online / not-busy — the geo index carries neither', async () => {
      const repo = makeRepo([]);
      repo.findNearby.mockResolvedValue([
        driver('rider-busy', { available: true, status: DRIVER_STATUS.ON_DELIVERY, busy: true }),
        driver('rider-free', { available: true, status: DRIVER_STATUS.ACTIVE }),
      ]);

      const provider = createAvailableDriversProvider(repo, async () => RESTAURANT_POINT, RADIUS);

      expect(await provider('rest-1')).toEqual(['rider-free']);
    });

    it('falls back to the global available list when nobody eligible is in range', async () => {
      const repo = makeRepo([driver('rider-global', { available: true, status: DRIVER_STATUS.ACTIVE })]);
      repo.findNearby.mockResolvedValue([]);

      const provider = createAvailableDriversProvider(repo, async () => RESTAURANT_POINT, RADIUS);

      expect(await provider('rest-1')).toEqual(['rider-global']);
      expect(repo.findAvailable).toHaveBeenCalled();
    });

    it('falls back to the global available list when the restaurant location is unknown', async () => {
      const repo = makeRepo([driver('rider-global', { available: true, status: DRIVER_STATUS.ACTIVE })]);

      const provider = createAvailableDriversProvider(repo, noLocation, RADIUS);

      expect(await provider('rest-1')).toEqual(['rider-global']);
      expect(repo.findNearby).not.toHaveBeenCalled();
    });
  });
});
