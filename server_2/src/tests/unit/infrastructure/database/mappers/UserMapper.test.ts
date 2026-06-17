import { randomUUID } from 'crypto';
import { Customer } from '../../../../../domain/identity/entities/Customer';
import { Driver } from '../../../../../domain/identity/entities/Driver';
import { Admin } from '../../../../../domain/identity/entities/Admin';
import { USER_ROLE } from '../../../../../domain/identity/enums/user-role.enum';
import { AUTH_PROVIDER } from '../../../../../domain/identity/enums/auth-provider.enum';
import { DRIVER_STATUS } from '../../../../../domain/identity/enums/driver-status.enum';
import { VehicleInfo } from '../../../../../domain/identity/value-objects/VehicleInfo.vo';
import { DomainError } from '../../../../../domain/shared/errors/DomainError';
import { UserMapper, AnyUserDocument } from '../../../../../infrastructure/database/mappers/UserMapper';

function baseFields(role: (typeof USER_ROLE)[keyof typeof USER_ROLE]) {
  const now = new Date('2024-04-01T00:00:00.000Z');
  return {
    _id: randomUUID(),
    name: 'Test User',
    email: `${role.toLowerCase()}@example.com`,
    phone: '+919876500000',
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
    lastLoginAt: null,
    lastLoginIp: null,
    isBanned: false,
    banReason: null,
    isActive: true,
    deletedAt: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

function buildCustomer(): Customer {
  return new Customer(baseFields(USER_ROLE.CUSTOMER));
}

function buildDriver(): Driver {
  const vehicle = VehicleInfo.create({
    type: 'BIKE',
    brand: 'Honda',
    model: 'Activa',
    licensePlate: 'MH12AB1234',
    rcDocumentUrl: 'https://example.com/rc.pdf',
    insuranceUrl: 'https://example.com/insurance.pdf',
  }).getValue();

  return new Driver({
    ...baseFields(USER_ROLE.DRIVER),
    driverStatus: DRIVER_STATUS.ACTIVE,
    vehicle,
    currentLocation: null,
    locationUpdatedAt: null,
  });
}

function buildAdmin(): Admin {
  return new Admin(baseFields(USER_ROLE.ADMIN));
}

describe('UserMapper', () => {
  it('dispatches Customer toPersistence/toDomain', () => {
    const customer = buildCustomer();

    const doc = UserMapper.toPersistence(customer);
    expect(doc.role).toBe(USER_ROLE.CUSTOMER);

    const rehydrated = UserMapper.toDomain(doc);
    expect(rehydrated).toBeInstanceOf(Customer);
    expect(rehydrated._id).toBe(customer._id);
    expect(rehydrated.role).toBe(USER_ROLE.CUSTOMER);
    expect(rehydrated.pullDomainEvents()).toEqual([]);
  });

  it('dispatches Driver toPersistence/toDomain', () => {
    const driver = buildDriver();

    const doc = UserMapper.toPersistence(driver);
    expect(doc.role).toBe(USER_ROLE.DRIVER);

    const rehydrated = UserMapper.toDomain(doc);
    expect(rehydrated).toBeInstanceOf(Driver);
    expect(rehydrated._id).toBe(driver._id);
    expect(rehydrated.role).toBe(USER_ROLE.DRIVER);
    expect(rehydrated.pullDomainEvents()).toEqual([]);
  });

  it('dispatches Admin toPersistence/toDomain', () => {
    const admin = buildAdmin();

    const doc = UserMapper.toPersistence(admin);
    expect(doc.role).toBe(USER_ROLE.ADMIN);

    const rehydrated = UserMapper.toDomain(doc);
    expect(rehydrated).toBeInstanceOf(Admin);
    expect(rehydrated._id).toBe(admin._id);
    expect(rehydrated.role).toBe(USER_ROLE.ADMIN);
    expect(rehydrated.pullDomainEvents()).toEqual([]);
  });

  it('throws DomainError for an unknown role on toDomain', () => {
    const doc = { ...UserMapper.toPersistence(buildCustomer()), role: 'UNKNOWN' } as unknown as AnyUserDocument;

    expect(() => UserMapper.toDomain(doc)).toThrow(DomainError);
  });

  it('throws DomainError for an unknown role on toPersistence', () => {
    const customer = buildCustomer();
    (customer as { role: string }).role = 'UNKNOWN';

    expect(() => UserMapper.toPersistence(customer)).toThrow(DomainError);
  });
});
