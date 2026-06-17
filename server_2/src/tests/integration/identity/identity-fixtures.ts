// Shared aggregate builders for the Phase 6 specialized-repository integration
// tests (Batch 5). Mirrors the builders in user-repository.integration.test.ts
// (Batch 4) but factored out so Customer/Driver/Admin repository tests can reuse
// them without duplicating the ~20 base fields.
import { randomUUID } from 'crypto';
import { Customer } from '../../../domain/identity/entities/Customer';
import { Driver } from '../../../domain/identity/entities/Driver';
import { Admin } from '../../../domain/identity/entities/Admin';
import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';
import { VehicleInfo } from '../../../domain/identity/value-objects/VehicleInfo.vo';
import { Permission } from '../../../domain/identity/value-objects/Permission.vo';
import { USER_ROLE, UserRole } from '../../../domain/identity/enums/user-role.enum';
import { AUTH_PROVIDER } from '../../../domain/identity/enums/auth-provider.enum';
import { DRIVER_STATUS } from '../../../domain/identity/enums/driver-status.enum';

export function baseFields(role: UserRole, overrides: Record<string, unknown> = {}) {
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

// `overrides` is applied twice: once into `baseFields` (so base-user fields like
// `name`/`email` take effect) and once on top of the subtype defaults (so
// subtype-specific fields like `referralCode`/`isAvailable`/`permissions` can be
// overridden too).

export function buildCustomer(overrides: Record<string, unknown> = {}): Customer {
  return new Customer({
    ...baseFields(USER_ROLE.CUSTOMER, overrides),
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
  });
}

export function buildDriver(overrides: Record<string, unknown> = {}): Driver {
  const vehicle = VehicleInfo.create({
    type: 'BIKE',
    brand: 'Honda',
    model: 'Activa',
    licensePlate: 'MH12AB1234',
    rcDocumentUrl: 'https://example.com/rc.pdf',
    insuranceUrl: 'https://example.com/insurance.pdf',
  }).getValue();

  return new Driver({
    ...baseFields(USER_ROLE.DRIVER, overrides),
    driverStatus: DRIVER_STATUS.ACTIVE,
    vehicle,
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
  });
}

export function buildAdmin(overrides: Record<string, unknown> = {}): Admin {
  return new Admin({
    ...baseFields(USER_ROLE.ADMIN, overrides),
    department: 'Operations',
    isSuperAdmin: false,
    managedBy: '',
    permissions: [],
    twoFactorEnabled: false,
    twoFactorSecret: null,
    auditLog: [],
    lastActivityAt: null,
    ...overrides,
  });
}

export { GeoPoint, Permission };
