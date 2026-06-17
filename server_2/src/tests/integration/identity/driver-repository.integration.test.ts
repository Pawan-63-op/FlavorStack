import { Driver } from '../../../domain/identity/entities/Driver';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoUserRepository } from '../../../infrastructure/repositories/UserRepository';
import { MongoDriverRepository } from '../../../infrastructure/repositories/DriverRepository';
import { UserModel } from '../../../infrastructure/database/models/UserModel';
import { DriverModel } from '../../../infrastructure/database/models/DriverModel';
import { buildDriver, GeoPoint } from './identity-fixtures';

describe('MongoDriverRepository', () => {
  let txContext: TransactionContext;
  let userRepo: MongoUserRepository;
  let repo: MongoDriverRepository;

  beforeAll(async () => {
    // findNearby relies on the 2dsphere index (DriverModel.ts); Mongoose builds
    // indexes asynchronously, so build them explicitly before querying.
    await Promise.all([UserModel.createIndexes(), DriverModel.createIndexes()]);
  });

  beforeEach(() => {
    txContext = new TransactionContext();
    userRepo = new MongoUserRepository(txContext);
    repo = new MongoDriverRepository(txContext);
  });

  afterEach(async () => {
    await UserModel.deleteMany({});
  });

  describe('findNearby', () => {
    it('returns drivers within the radius, ordered by distance', async () => {
      const center = GeoPoint.create(18.52, 73.85).getValue(); // Pune
      const near = GeoPoint.create(18.521, 73.851).getValue(); // ~150m away
      const far = GeoPoint.create(19.07, 72.87).getValue(); // Mumbai, ~120km away

      const nearDriver = buildDriver({ name: 'Near Driver' });
      nearDriver.updateLocation(near);
      const farDriver = buildDriver({ name: 'Far Driver' });
      farDriver.updateLocation(far);

      await userRepo.save(nearDriver);
      await userRepo.save(farDriver);

      const results = await repo.findNearby(center, 5000); // 5km radius

      expect(results).toHaveLength(1);
      expect(results[0]).toBeInstanceOf(Driver);
      expect(results[0]._id).toBe(nearDriver._id);
      expect(results[0].pullDomainEvents()).toEqual([]);
    });

    it('excludes drivers without a current location', async () => {
      const center = GeoPoint.create(18.52, 73.85).getValue();
      const noLocation = buildDriver({ name: 'No Location Driver' });
      await userRepo.save(noLocation);

      const results = await repo.findNearby(center, 5000);
      expect(results.find((d) => d._id === noLocation._id)).toBeUndefined();
    });

    it('excludes soft-deleted drivers', async () => {
      const center = GeoPoint.create(18.52, 73.85).getValue();
      const driver = buildDriver({ name: 'Deleted Driver' });
      driver.updateLocation(center);
      await userRepo.save(driver);
      await userRepo.softDelete(driver._id);

      const results = await repo.findNearby(center, 5000);
      expect(results.find((d) => d._id === driver._id)).toBeUndefined();
    });
  });

  describe('findAvailable', () => {
    it('returns only drivers marked available', async () => {
      const available = buildDriver({ name: 'Available Driver', isAvailable: true });
      const unavailable = buildDriver({ name: 'Unavailable Driver', isAvailable: false });
      await userRepo.save(available);
      await userRepo.save(unavailable);

      const results = await repo.findAvailable();

      const ids = results.map((d) => d._id);
      expect(ids).toContain(available._id);
      expect(ids).not.toContain(unavailable._id);
      expect(results.every((d) => d instanceof Driver)).toBe(true);
      expect(results.every((d) => d.pullDomainEvents().length === 0)).toBe(true);
    });

    it('excludes soft-deleted available drivers', async () => {
      const driver = buildDriver({ name: 'Deleted Available Driver', isAvailable: true });
      await userRepo.save(driver);
      await userRepo.softDelete(driver._id);

      const results = await repo.findAvailable();
      expect(results.find((d) => d._id === driver._id)).toBeUndefined();
    });
  });
});
