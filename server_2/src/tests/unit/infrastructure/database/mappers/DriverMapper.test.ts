import { randomUUID } from 'crypto';
import { Driver } from '../../../../../domain/identity/entities/Driver';
import { USER_ROLE } from '../../../../../domain/identity/enums/user-role.enum';
import { AUTH_PROVIDER } from '../../../../../domain/identity/enums/auth-provider.enum';
import { DRIVER_STATUS } from '../../../../../domain/identity/enums/driver-status.enum';
import { VehicleInfo } from '../../../../../domain/identity/value-objects/VehicleInfo.vo';
import { GeoPoint } from '../../../../../domain/identity/value-objects/GeoPoint.vo';
import { DriverMapper } from '../../../../../infrastructure/database/mappers/DriverMapper';

function buildDriver(overrides: { currentLocation?: GeoPoint | null } = {}): Driver {
  const now = new Date('2024-02-01T08:30:00.000Z');
  const vehicle = VehicleInfo.create({
    type: 'BIKE',
    brand: 'Honda',
    model: 'Activa',
    licensePlate: 'mh12ab1234',
    rcDocumentUrl: 'https://example.com/rc.pdf',
    insuranceUrl: 'https://example.com/insurance.pdf',
  }).getValue();

  const currentLocation =
    overrides.currentLocation !== undefined
      ? overrides.currentLocation
      : GeoPoint.create(18.52, 73.85).getValue();

  return new Driver({
    _id: randomUUID(),
    name: 'Ravi Kumar',
    email: 'ravi@example.com',
    phone: '+919876543211',
    avatarUrl: '',
    role: USER_ROLE.DRIVER,
    passwordHash: 'hashed-password',
    authProvider: AUTH_PROVIDER.LOCAL,
    providerId: '',
    isEmailVerified: true,
    passwordChangedAt: null,
    tokenVersion: 0,
    loginAttempts: 0,
    lockUntil: null,
    lastLoginAt: now,
    lastLoginIp: '10.0.0.1',
    isBanned: false,
    banReason: null,
    isActive: true,
    deletedAt: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    driverStatus: DRIVER_STATUS.ACTIVE,
    vehicle,
    currentLocation,
    locationUpdatedAt: now,
    isAvailable: true,
    activeOrderId: 'order-1',
    totalEarnings: 15000,
    pendingPayout: 2000,
    stripeAccountId: 'acct_123',
    averageRating: 4.5,
    totalDeliveries: 10,
    totalRatings: 8,
    fcmTokens: ['token-a', 'token-b'],
  });
}

describe('DriverMapper', () => {
  it('round-trips toPersistence -> toDomain preserving base and driver fields', () => {
    const original = buildDriver();

    const doc = DriverMapper.toPersistence(original);
    expect(doc._id).toBe(original._id);
    expect(doc.role).toBe(USER_ROLE.DRIVER);
    expect(doc.vehicle).toEqual({
      type: 'BIKE',
      brand: 'Honda',
      model: 'Activa',
      licensePlate: 'MH12AB1234',
      rcDocumentUrl: 'https://example.com/rc.pdf',
      insuranceUrl: 'https://example.com/insurance.pdf',
    });
    expect(doc.currentLocation).toEqual({ type: 'Point', coordinates: [73.85, 18.52] });

    const rehydrated = DriverMapper.toDomain(doc);

    expect(rehydrated).toBeInstanceOf(Driver);
    expect(rehydrated._id).toBe(original._id);
    expect(rehydrated.driverStatus).toBe(original.driverStatus);
    expect(rehydrated.vehicle.equals(original.vehicle)).toBe(true);
    expect(rehydrated.currentLocation).not.toBeNull();
    expect(rehydrated.currentLocation!.equals(original.currentLocation!)).toBe(true);
    expect(rehydrated.locationUpdatedAt).toEqual(original.locationUpdatedAt);
    expect(rehydrated.isAvailable).toBe(original.isAvailable);
    expect(rehydrated.activeOrderId).toBe(original.activeOrderId);
    expect(rehydrated.totalEarnings).toBe(original.totalEarnings);
    expect(rehydrated.pendingPayout).toBe(original.pendingPayout);
    expect(rehydrated.stripeAccountId).toBe(original.stripeAccountId);
    expect(rehydrated.averageRating).toBe(original.averageRating);
    expect(rehydrated.totalDeliveries).toBe(original.totalDeliveries);
    expect(rehydrated.totalRatings).toBe(original.totalRatings);
    expect(rehydrated.fcmTokens).toEqual(original.fcmTokens);
  });

  it('maps a null currentLocation to null in both directions', () => {
    const original = buildDriver({ currentLocation: null });

    const doc = DriverMapper.toPersistence(original);
    expect(doc.currentLocation).toBeNull();

    const rehydrated = DriverMapper.toDomain(doc);
    expect(rehydrated.currentLocation).toBeNull();
  });

  it('produces no domain events on a rehydrated aggregate', () => {
    const original = buildDriver();
    const doc = DriverMapper.toPersistence(original);
    const rehydrated = DriverMapper.toDomain(doc);

    expect(rehydrated.pullDomainEvents()).toEqual([]);
  });

  it('toPersistence is stable across a second round-trip', () => {
    const original = buildDriver();
    const doc = DriverMapper.toPersistence(original);
    const rehydrated = DriverMapper.toDomain(doc);
    const doc2 = DriverMapper.toPersistence(rehydrated);

    expect(doc2).toEqual(doc);
  });
});
