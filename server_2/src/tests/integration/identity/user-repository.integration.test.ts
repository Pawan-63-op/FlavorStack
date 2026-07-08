import { randomUUID } from 'crypto';
import { Customer } from '../../../domain/identity/entities/Customer';
import { Driver } from '../../../domain/identity/entities/Driver';
import { Admin } from '../../../domain/identity/entities/Admin';
import { Email } from '../../../domain/identity/value-objects/Email.vo';
import { Address } from '../../../domain/identity/value-objects/Address.vo';
import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';
import { VehicleInfo } from '../../../domain/identity/value-objects/VehicleInfo.vo';
import { Permission } from '../../../domain/identity/value-objects/Permission.vo';
import { USER_ROLE, UserRole } from '../../../domain/identity/enums/user-role.enum';
import { AuditEntry } from '../../../domain/identity/value-objects/AuditEntry.vo';
import { AUTH_PROVIDER } from '../../../domain/identity/enums/auth-provider.enum';
import { DRIVER_STATUS } from '../../../domain/identity/enums/driver-status.enum';
import { PERMISSION_RESOURCE } from '../../../domain/identity/enums/permission-resource.enum';
import { PERMISSION_ACTION } from '../../../domain/identity/enums/permission-action.enum';
import { ConflictError } from '../../../domain/shared/errors/ConflictError';
import { getConnection } from '../../../infrastructure/database/connection';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoUnitOfWork } from '../../../infrastructure/database/MongoUnitOfWork';
import { MongoUserRepository } from '../../../infrastructure/repositories/UserRepository';
import { UserModel } from '../../../infrastructure/database/models/UserModel';

function baseFields(role: UserRole, overrides: Record<string, unknown> = {}) {
  const now = new Date('2024-01-15T10:00:00.000Z');
  return {
    _id: randomUUID(),
    name: 'Test User',
    email: `user-${randomUUID()}@example.com`,
    phone: `+91${Math.floor(7_000_000_000 + Math.random() * 2_000_000_000)}`,
    avatarUrl: '',
    role,
    passwordHash: 'hashed-password',
    authProvider: AUTH_PROVIDER.LOCAL,
    providerId: '',
    isEmailVerified: true,
    passwordChangedAt: null,
    tokenVersion: 0,
    loginAttempts: 0,
    lockUntil: null,
    lastLoginAt: now,
    lastLoginIp: '127.0.0.1',
    isBanned: false,
    banReason: null,
    isActive: true,
    deletedAt: null,
    version: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function buildCustomer(overrides: Record<string, unknown> = {}): Customer {
  const coordinates = GeoPoint.create(18.52, 73.85).getValue();
  const address = Address.create({
    label: 'Home',
    street: '12 MG Road',
    city: 'Pune',
    state: 'MH',
    pinCode: '411001',
    coordinates,
  }).getValue();

  return new Customer({
    ...baseFields(USER_ROLE.CUSTOMER, overrides),
    addresses: [{ id: 'addr-1', address }],
    defaultAddressId: 'addr-1',
    walletBalance: 5000,
    walletCurrency: 'INR',
    walletTransactions: [],
    loyaltyPoints: 120,
    totalLifetimeSpend: 8000,
    referralCode: randomUUID().slice(0, 8).toUpperCase(),
    referredBy: null,
    referralCount: 0,
    savedRestaurants: ['rest-1'],
    dietaryPreferences: ['VEGAN'],
    defaultPaymentMethod: 'CARD',
    fcmTokens: ['token-1'],
    notificationsEnabled: false,
  });
}

function buildDriver(overrides: Record<string, unknown> = {}): Driver {
  const vehicle = VehicleInfo.create({
    type: 'BIKE',
    brand: 'Honda',
    model: 'Activa',
    licensePlate: 'MH12AB1234',
    rcDocumentUrl: 'https://example.com/rc.pdf',
    insuranceUrl: 'https://example.com/insurance.pdf',
  }).getValue();
  const currentLocation = GeoPoint.create(18.52, 73.85).getValue();

  return new Driver({
    ...baseFields(USER_ROLE.DRIVER, overrides),
    driverStatus: DRIVER_STATUS.ACTIVE,
    vehicle,
    currentLocation,
    locationUpdatedAt: new Date('2024-01-15T10:00:00.000Z'),
    isAvailable: true,
    activeOrderId: null,
    totalEarnings: 15000,
    pendingPayout: 2000,
    stripeAccountId: 'acct_123',
    averageRating: 4.5,
    totalDeliveries: 10,
    totalRatings: 8,
    fcmTokens: ['token-a'],
  });
}

function buildAdmin(overrides: Record<string, unknown> = {}): Admin {
  const permission = Permission.create({
    resource: PERMISSION_RESOURCE.ORDER,
    action: PERMISSION_ACTION.UPDATE,
    scope: 'region:pune',
  }).getValue();

  const auditEntry: AuditEntry = {
    action: 'BAN_USER',
    targetModel: 'User',
    targetId: 'user-123',
    meta: { reason: 'fraud' },
    performedAt: new Date('2024-01-15T10:00:00.000Z'),
    details: 'Banned for repeated chargebacks',
    ipAddress: '127.0.0.1',
  };

  return new Admin({
    ...baseFields(USER_ROLE.ADMIN, overrides),
    department: 'Operations',
    isSuperAdmin: false,
    managedBy: 'admin-root-id',
    permissions: [permission],
    twoFactorEnabled: true,
    twoFactorSecret: 'secret-123',
    auditLog: [auditEntry],
    lastActivityAt: new Date('2024-01-15T10:00:00.000Z'),
  });
}

describe('MongoUserRepository', () => {
  let txContext: TransactionContext;
  let repo: MongoUserRepository;

  beforeEach(() => {
    txContext = new TransactionContext();
    repo = new MongoUserRepository(txContext);
  });

  afterEach(async () => {
    await UserModel.deleteMany({});
  });

  describe('aggregate round-trip', () => {
    it('saves and rehydrates a Customer with addresses and wallet', async () => {
      const original = buildCustomer();
      await repo.save(original);

      const found = await repo.findById(original._id);
      expect(found).toBeInstanceOf(Customer);
      const customer = found as Customer;
      expect(customer._id).toBe(original._id);
      expect(customer.email).toBe(original.email);
      expect(customer.role).toBe(USER_ROLE.CUSTOMER);
      expect(customer.walletBalance).toBe(5000);
      expect(customer.addresses[0].address.equals(original.addresses[0].address)).toBe(true);
      expect(customer.pullDomainEvents()).toEqual([]);
    });

    it('saves and rehydrates a Driver with vehicle and GeoJSON location', async () => {
      const original = buildDriver();
      await repo.save(original);

      const found = await repo.findById(original._id);
      expect(found).toBeInstanceOf(Driver);
      const driver = found as Driver;
      expect(driver.role).toBe(USER_ROLE.DRIVER);
      expect(driver.vehicle.equals(original.vehicle)).toBe(true);
      expect(driver.currentLocation?.equals(original.currentLocation!)).toBe(true);
      expect(driver.pullDomainEvents()).toEqual([]);
    });

    it('saves and rehydrates an Admin with permissions and audit log', async () => {
      const original = buildAdmin();
      await repo.save(original);

      const found = await repo.findById(original._id);
      expect(found).toBeInstanceOf(Admin);
      const admin = found as Admin;
      expect(admin.role).toBe(USER_ROLE.ADMIN);
      expect(admin.permissions[0].equals(original.permissions[0])).toBe(true);
      expect(admin.auditLog[0].action).toBe('BAN_USER');
      expect(admin.pullDomainEvents()).toEqual([]);
    });

    it('returns null for an unknown id', async () => {
      expect(await repo.findById(randomUUID())).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('finds a user by normalized (lowercase) email', async () => {
      const original = buildCustomer({ email: 'casetest@example.com' });
      await repo.save(original);

      const found = await repo.findByEmail(Email.create('CaseTest@Example.COM').getValue());
      expect(found).not.toBeNull();
      expect(found?._id).toBe(original._id);
    });

    it('returns null when no user matches', async () => {
      const found = await repo.findByEmail(Email.create('nobody@example.com').getValue());
      expect(found).toBeNull();
    });
  });

  describe('existsByEmail', () => {
    it('returns true for an existing user', async () => {
      const original = buildCustomer({ email: 'exists@example.com' });
      await repo.save(original);
      expect(await repo.existsByEmail(Email.create('EXISTS@example.com').getValue())).toBe(true);
    });

    it('returns false when no user matches', async () => {
      expect(await repo.existsByEmail(Email.create('ghost@example.com').getValue())).toBe(false);
    });
  });

  describe('softDelete', () => {
    it('hides the user from finders but keeps the document', async () => {
      const original = buildCustomer({ email: 'soft@example.com' });
      await repo.save(original);

      await repo.softDelete(original._id);

      expect(await repo.findById(original._id)).toBeNull();
      expect(await repo.findByEmail(Email.create('soft@example.com').getValue())).toBeNull();
      expect(await repo.existsByEmail(Email.create('soft@example.com').getValue())).toBe(false);

      const raw = await UserModel.findById(original._id).lean();
      expect(raw).not.toBeNull();
      expect(raw?.deletedAt).not.toBeNull();
      expect(raw?.isActive).toBe(false);
    });
  });

  describe('optimistic locking', () => {
    it('increments the persisted version on update', async () => {
      const original = buildCustomer();
      await repo.save(original);

      await repo.update(original);

      const raw = await UserModel.findById(original._id).lean();
      expect(raw?.version).toBe(1);
    });

    it('throws ConflictError when the version is stale', async () => {
      const original = buildCustomer();
      await repo.save(original);

      const loadA = (await repo.findById(original._id)) as Customer;
      const loadB = (await repo.findById(original._id)) as Customer;

      await repo.update(loadA); // version 0 -> 1, succeeds

      await expect(repo.update(loadB)).rejects.toBeInstanceOf(ConflictError);
    });

    it('throws ConflictError when updating a missing user', async () => {
      const ghost = buildCustomer();
      await expect(repo.update(ghost)).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('transaction / session participation', () => {
    it('commits the save when the transaction succeeds', async () => {
      const uow = new MongoUnitOfWork(getConnection(), txContext);
      const original = buildCustomer();

      await uow.runInTransaction(async () => {
        await repo.save(original);
      });

      expect(await repo.findById(original._id)).not.toBeNull();
    });

    it('rolls back the save when the transaction throws', async () => {
      const uow = new MongoUnitOfWork(getConnection(), txContext);
      const original = buildCustomer();

      await expect(
        uow.runInTransaction(async () => {
          await repo.save(original);
          throw new Error('work failed');
        }),
      ).rejects.toThrow('work failed');

      expect(await repo.findById(original._id)).toBeNull();
    });
  });
});
