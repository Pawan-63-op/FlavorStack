import { randomUUID } from 'crypto';
import { UserModel, UserDocument } from '../../../infrastructure/database/models/UserModel';
import { CustomerModel, CustomerDocument } from '../../../infrastructure/database/models/CustomerModel';
import { DriverModel, DriverDocument } from '../../../infrastructure/database/models/DriverModel';
import { AdminModel, AdminDocument } from '../../../infrastructure/database/models/AdminModel';
import { OutboxEventModel, OUTBOX_STATUS } from '../../../infrastructure/database/models/OutboxEventModel';
import { AuditLogModel } from '../../../infrastructure/database/models/AuditLogModel';
import { USER_ROLE } from '../../../domain/identity/enums/user-role.enum';
import { AUTH_PROVIDER } from '../../../domain/identity/enums/auth-provider.enum';
import { DRIVER_STATUS } from '../../../domain/identity/enums/driver-status.enum';
import { PERMISSION_RESOURCE } from '../../../domain/identity/enums/permission-resource.enum';
import { PERMISSION_ACTION } from '../../../domain/identity/enums/permission-action.enum';

function baseFields(overrides: Partial<UserDocument> = {}): UserDocument {
  const now = new Date();
  return {
    _id: randomUUID(),
    name: 'Test User',
    email: `user-${randomUUID()}@example.com`,
    phone: `+1${Math.floor(1_000_000_000 + Math.random() * 8_000_000_000)}`,
    avatarUrl: '',
    role: USER_ROLE.CUSTOMER,
    passwordHash: 'hashed-password',
    authProvider: AUTH_PROVIDER.LOCAL,
    providerId: '',
    isEmailVerified: false,
    passwordChangedAt: null,
    tokenVersion: 0,
    loginAttempts: 0,
    lockUntil: null,
    lastLoginAt: null,
    lastLoginIp: null,
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

function customerFields(overrides: Partial<CustomerDocument> = {}): CustomerDocument {
  return {
    ...baseFields({ role: USER_ROLE.CUSTOMER }),
    addresses: [],
    defaultAddressId: null,
    walletBalance: 0,
    walletCurrency: 'INR',
    walletTransactions: [],
    loyaltyPoints: 0,
    totalLifetimeSpend: 0,
    referralCode: randomUUID().slice(0, 8).toUpperCase(),
    referredBy: null,
    referralCount: 0,
    savedRestaurants: [],
    dietaryPreferences: [],
    defaultPaymentMethod: null,
    fcmTokens: [],
    notificationsEnabled: true,
    ...overrides,
  };
}

function driverFields(overrides: Partial<DriverDocument> = {}): DriverDocument {
  return {
    ...baseFields({ role: USER_ROLE.DRIVER }),
    driverStatus: DRIVER_STATUS.PENDING_VERIFICATION,
    vehicle: {
      type: 'BIKE',
      brand: 'Honda',
      model: 'Activa',
      licensePlate: 'MH12AB1234',
      rcDocumentUrl: 'https://example.com/rc.pdf',
      insuranceUrl: 'https://example.com/insurance.pdf',
    },
    currentLocation: null,
    locationUpdatedAt: null,
    isAvailable: false,
    activeOrderId: null,
    totalEarnings: 0,
    pendingPayout: 0,
    stripeAccountId: null,
    averageRating: 0,
    totalDeliveries: 0,
    totalRatings: 0,
    fcmTokens: [],
    ...overrides,
  };
}

function adminFields(overrides: Partial<AdminDocument> = {}): AdminDocument {
  return {
    ...baseFields({ role: USER_ROLE.ADMIN }),
    department: 'Operations',
    isSuperAdmin: false,
    managedBy: null,
    permissions: [],
    twoFactorEnabled: false,
    twoFactorSecret: null,
    auditLog: [],
    lastActivityAt: null,
    ...overrides,
  };
}

describe('Identity Mongo models — registration & indexes', () => {
  beforeAll(async () => {
    await Promise.all([
      UserModel.createIndexes(),
      CustomerModel.createIndexes(),
      DriverModel.createIndexes(),
      AdminModel.createIndexes(),
      OutboxEventModel.createIndexes(),
      AuditLogModel.createIndexes(),
    ]);
  });

  afterEach(async () => {
    await Promise.all([
      UserModel.deleteMany({}),
      OutboxEventModel.deleteMany({}),
      AuditLogModel.deleteMany({}),
    ]);
  });

  it('registers CUSTOMER, DRIVER, ADMIN discriminators on the base User model', () => {
    const discriminators = Object.keys(UserModel.discriminators ?? {});
    expect(discriminators.sort()).toEqual([USER_ROLE.ADMIN, USER_ROLE.CUSTOMER, USER_ROLE.DRIVER].sort());
  });

  it('builds the expected indexes on the users collection', async () => {
    const indexes = await UserModel.collection.indexes();
    const byKey = new Map(indexes.map((idx) => [JSON.stringify(idx.key), idx]));

    expect(byKey.get(JSON.stringify({ email: 1 }))).toMatchObject({
      unique: true,
      partialFilterExpression: { deletedAt: null },
    });
    expect(byKey.get(JSON.stringify({ phone: 1 }))).toMatchObject({
      unique: true,
      partialFilterExpression: { deletedAt: null },
    });
    expect(byKey.get(JSON.stringify({ role: 1 }))).toBeDefined();
    expect(byKey.get(JSON.stringify({ deletedAt: 1 }))).toMatchObject({ sparse: true });
    expect(byKey.get(JSON.stringify({ referralCode: 1 }))).toMatchObject({ unique: true, sparse: true });
    expect(byKey.get(JSON.stringify({ currentLocation: '2dsphere' }))).toBeDefined();
    expect(byKey.get(JSON.stringify({ isAvailable: 1 }))).toBeDefined();
  });

  it('round-trips a Customer document through the discriminator', async () => {
    const doc = customerFields({
      addresses: [
        {
          id: randomUUID(),
          street: '12 MG Road',
          city: 'Pune',
          state: 'MH',
          pinCode: '411001',
          coordinates: { lat: 18.52, lng: 73.85 },
        },
      ],
      walletTransactions: [
        {
          txId: randomUUID(),
          type: 'CREDIT',
          amount: 500,
          currency: 'INR',
          source: 'TOPUP',
          referenceId: randomUUID(),
          createdAt: new Date(),
        },
      ],
    });

    await CustomerModel.create(doc);

    const found = await UserModel.findById(doc._id).lean();
    expect(found?.role).toBe(USER_ROLE.CUSTOMER);
    expect((found as unknown as CustomerDocument).addresses).toHaveLength(1);
    expect((found as unknown as CustomerDocument).walletTransactions[0].amount).toBe(500);
  });

  it('round-trips a Driver document with a 2dsphere-indexed location', async () => {
    const doc = driverFields({
      currentLocation: { type: 'Point', coordinates: [73.85, 18.52] },
      isAvailable: true,
      driverStatus: DRIVER_STATUS.ACTIVE,
    });

    await DriverModel.create(doc);

    const found = await UserModel.findById(doc._id).lean();
    expect(found?.role).toBe(USER_ROLE.DRIVER);
    expect((found as unknown as DriverDocument).vehicle.licensePlate).toBe('MH12AB1234');

    const nearby = await DriverModel.find({
      currentLocation: {
        $near: {
          $geometry: { type: 'Point', coordinates: [73.85, 18.52] },
          $maxDistance: 5000,
        },
      },
    });
    expect(nearby.map((d) => d._id)).toContain(doc._id);
  });

  it('round-trips an Admin document with permissions and audit log entries', async () => {
    const doc = adminFields({
      permissions: [{ resource: PERMISSION_RESOURCE.ORDER, action: PERMISSION_ACTION.READ }],
      auditLog: [{ action: 'BAN_USER', meta: { targetId: 'abc' }, performedAt: new Date() }],
    });

    await AdminModel.create(doc);

    const found = await UserModel.findById(doc._id).lean();
    expect(found?.role).toBe(USER_ROLE.ADMIN);
    expect((found as unknown as AdminDocument).permissions[0]).toMatchObject({
      resource: PERMISSION_RESOURCE.ORDER,
      action: PERMISSION_ACTION.READ,
    });
    expect((found as unknown as AdminDocument).auditLog[0].action).toBe('BAN_USER');
  });

  it('enforces the partial-unique email index only for non-soft-deleted users', async () => {
    const email = `dup-${randomUUID()}@example.com`;

    await CustomerModel.create(customerFields({ email }));
    await expect(CustomerModel.create(customerFields({ email }))).rejects.toThrow(/E11000/);

    await UserModel.updateOne({ email }, { $set: { deletedAt: new Date(), isActive: false } });
    await expect(CustomerModel.create(customerFields({ email }))).resolves.toBeDefined();
  });

  it('enforces the unique referralCode index across customers', async () => {
    const referralCode = randomUUID().slice(0, 8).toUpperCase();

    await CustomerModel.create(customerFields({ referralCode }));
    await expect(CustomerModel.create(customerFields({ referralCode }))).rejects.toThrow(/E11000/);
  });

  it('registers the OutboxEvent model and enforces unique eventId', async () => {
    const eventId = randomUUID();
    const row = {
      eventId,
      eventName: 'UserRegistered',
      aggregateId: randomUUID(),
      aggregateType: 'user',
      payload: { foo: 'bar' },
      status: OUTBOX_STATUS.PENDING,
      retryCount: 0,
      createdAt: new Date(),
      processedAt: null,
    };

    await OutboxEventModel.create(row);
    await expect(OutboxEventModel.create(row)).rejects.toThrow(/E11000/);

    const indexes = await OutboxEventModel.collection.indexes();
    const keys = indexes.map((idx) => JSON.stringify(idx.key));
    expect(keys).toContain(JSON.stringify({ status: 1, nextAttemptAt: 1 }));
  });

  it('registers the AuditLog model with optional fields', async () => {
    await AuditLogModel.create({
      actorId: randomUUID(),
      action: 'GRANT_PERMISSION',
      performedAt: new Date(),
    });

    const indexes = await AuditLogModel.collection.indexes();
    const keys = indexes.map((idx) => JSON.stringify(idx.key));
    expect(keys).toContain(JSON.stringify({ actorId: 1, performedAt: 1 }));
  });
});
