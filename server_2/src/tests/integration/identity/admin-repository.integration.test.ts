import { Admin } from '../../../domain/identity/entities/Admin';
import { PERMISSION_RESOURCE } from '../../../domain/identity/enums/permission-resource.enum';
import { PERMISSION_ACTION } from '../../../domain/identity/enums/permission-action.enum';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoUserRepository } from '../../../infrastructure/repositories/UserRepository';
import { MongoAdminRepository } from '../../../infrastructure/repositories/AdminRepository';
import { UserModel } from '../../../infrastructure/database/models/UserModel';
import { buildAdmin, Permission } from './identity-fixtures';

describe('MongoAdminRepository', () => {
  let txContext: TransactionContext;
  let userRepo: MongoUserRepository;
  let repo: MongoAdminRepository;

  beforeEach(() => {
    txContext = new TransactionContext();
    userRepo = new MongoUserRepository(txContext);
    repo = new MongoAdminRepository(txContext);
  });

  afterEach(async () => {
    await UserModel.deleteMany({});
  });

  describe('findByPermission', () => {
    it('returns admins with a matching permission', async () => {
      const orderPermission = Permission.create({
        resource: PERMISSION_RESOURCE.ORDER,
        action: PERMISSION_ACTION.UPDATE,
      }).getValue();
      const matching = buildAdmin({ name: 'Order Manager', permissions: [orderPermission] });

      const menuPermission = Permission.create({
        resource: PERMISSION_RESOURCE.MENU,
        action: PERMISSION_ACTION.CREATE,
      }).getValue();
      const nonMatching = buildAdmin({ name: 'Menu Manager', permissions: [menuPermission] });

      await userRepo.save(matching);
      await userRepo.save(nonMatching);

      const results = await repo.findByPermission(PERMISSION_RESOURCE.ORDER, PERMISSION_ACTION.UPDATE);

      const ids = results.map((a) => a._id);
      expect(ids).toContain(matching._id);
      expect(ids).not.toContain(nonMatching._id);
      expect(results.every((a) => a instanceof Admin)).toBe(true);
      expect(results.every((a) => a.pullDomainEvents().length === 0)).toBe(true);
    });

    it('returns super admins regardless of their explicit permissions', async () => {
      const superAdmin = buildAdmin({ name: 'Root Admin', isSuperAdmin: true, permissions: [] });
      await userRepo.save(superAdmin);

      const results = await repo.findByPermission(PERMISSION_RESOURCE.WALLET, PERMISSION_ACTION.DELETE);

      expect(results.map((a) => a._id)).toContain(superAdmin._id);
    });

    it('excludes soft-deleted admins', async () => {
      const permission = Permission.create({
        resource: PERMISSION_RESOURCE.REVIEW,
        action: PERMISSION_ACTION.MANAGE,
      }).getValue();
      const admin = buildAdmin({ name: 'Deleted Admin', permissions: [permission] });
      await userRepo.save(admin);
      await userRepo.softDelete(admin._id);

      const results = await repo.findByPermission(PERMISSION_RESOURCE.REVIEW, PERMISSION_ACTION.MANAGE);
      expect(results.map((a) => a._id)).not.toContain(admin._id);
    });

    it('returns an empty array when no admin matches', async () => {
      const results = await repo.findByPermission(PERMISSION_RESOURCE.REPORT, PERMISSION_ACTION.READ);
      expect(results).toEqual([]);
    });
  });
});
