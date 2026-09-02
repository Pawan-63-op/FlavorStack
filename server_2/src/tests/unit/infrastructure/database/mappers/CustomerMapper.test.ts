import { randomUUID } from 'crypto';
import { Customer } from '../../../../../domain/identity/entities/Customer';
import { USER_ROLE } from '../../../../../domain/identity/enums/user-role.enum';
import { AUTH_PROVIDER } from '../../../../../domain/identity/enums/auth-provider.enum';
import { Address } from '../../../../../domain/identity/value-objects/Address.vo';
import { GeoPoint } from '../../../../../domain/identity/value-objects/GeoPoint.vo';
import { CustomerMapper } from '../../../../../infrastructure/database/mappers/CustomerMapper';

function buildCustomer(): Customer {
  const now = new Date('2024-01-15T10:00:00.000Z');
  const coordinates = GeoPoint.create(18.52, 73.85).getValue();
  const address = Address.create({
    label: 'Home',
    recipientName: 'Asha Verma',
    phone: '+919876543210',
    street: '12 MG Road',
    city: 'Pune',
    state: 'MH',
    pinCode: '411001',
    landmark: 'Near the clock tower',
    deliveryInstructions: 'Leave at the gate',
    coordinates,
  }).getValue();

  return new Customer({
    _id: randomUUID(),
    name: 'Asha Verma',
    email: 'asha@example.com',
    phone: '+919876543210',
    avatarUrl: 'https://example.com/avatar.png',
    role: USER_ROLE.CUSTOMER,
    passwordHash: 'hashed-password',
    authProvider: AUTH_PROVIDER.LOCAL,
    providerId: '',
    isEmailVerified: true,
    passwordChangedAt: now,
    tokenVersion: 2,
    loginAttempts: 1,
    lockUntil: null,
    lastLoginAt: now,
    lastLoginIp: '127.0.0.1',
    isBanned: false,
    banReason: null,
    isActive: true,
    deletedAt: null,
    version: 3,
    createdAt: now,
    updatedAt: now,
    addresses: [{ id: 'addr-1', address }],
    defaultAddressId: 'addr-1',
    walletBalance: 5000,
    walletCurrency: 'INR',
    walletTransactions: [
      {
        txId: randomUUID(),
        type: 'CREDIT',
        amount: 500,
        currency: 'INR',
        source: 'TOPUP',
        referenceId: randomUUID(),
        createdAt: now,
      },
    ],
    loyaltyPoints: 120,
    totalLifetimeSpend: 8000,
    referralCode: 'ABCD1234',
    referredBy: 'ZYXW9876',
    referralCount: 2,
    savedRestaurants: ['rest-1', 'rest-2'],
    dietaryPreferences: ['VEGAN'],
    defaultPaymentMethod: 'CARD',
    notificationsEnabled: false,
  });
}

describe('CustomerMapper', () => {
  it('round-trips toPersistence -> toDomain preserving base and customer fields', () => {
    const original = buildCustomer();

    const doc = CustomerMapper.toPersistence(original);
    expect(doc._id).toBe(original._id);
    expect(doc.role).toBe(USER_ROLE.CUSTOMER);
    expect(doc.addresses[0]).toMatchObject({
      id: 'addr-1',
      label: 'Home',
      recipientName: 'Asha Verma',
      phone: '+919876543210',
      street: '12 MG Road',
      city: 'Pune',
      state: 'MH',
      pinCode: '411001',
      landmark: 'Near the clock tower',
      deliveryInstructions: 'Leave at the gate',
      coordinates: { lat: 18.52, lng: 73.85 },
    });

    const rehydrated = CustomerMapper.toDomain(doc);

    expect(rehydrated).toBeInstanceOf(Customer);
    expect(rehydrated._id).toBe(original._id);
    expect(rehydrated.email).toBe(original.email);
    expect(rehydrated.role).toBe(USER_ROLE.CUSTOMER);
    expect(rehydrated.passwordHash).toBe(original.passwordHash);
    expect(rehydrated.version).toBe(original.version);
    expect(rehydrated.createdAt).toEqual(original.createdAt);

    expect(rehydrated.addresses[0].id).toBe('addr-1');
    expect(rehydrated.addresses[0].address.equals(original.addresses[0].address)).toBe(true);
    expect(rehydrated.addresses[0].address.coordinates.equals(original.addresses[0].address.coordinates)).toBe(true);
    expect(rehydrated.defaultAddressId).toBe('addr-1');

    expect(rehydrated.walletTransactions).toEqual(original.walletTransactions);

    expect(rehydrated.walletBalance).toBe(original.walletBalance);
    expect(rehydrated.loyaltyPoints).toBe(original.loyaltyPoints);
    expect(rehydrated.totalLifetimeSpend).toBe(original.totalLifetimeSpend);
    expect(rehydrated.referralCode).toBe(original.referralCode);
    expect(rehydrated.referredBy).toBe(original.referredBy);
    expect(rehydrated.referralCount).toBe(original.referralCount);
    expect(rehydrated.savedRestaurants).toEqual(original.savedRestaurants);
    expect(rehydrated.dietaryPreferences).toEqual(original.dietaryPreferences);
    expect(rehydrated.defaultPaymentMethod).toBe(original.defaultPaymentMethod);
    expect(rehydrated.notificationsEnabled).toBe(original.notificationsEnabled);
  });

  it('produces no domain events on a rehydrated aggregate', () => {
    const original = buildCustomer();
    const doc = CustomerMapper.toPersistence(original);
    const rehydrated = CustomerMapper.toDomain(doc);

    expect(rehydrated.pullDomainEvents()).toEqual([]);
  });

  it('toPersistence is stable across a second round-trip', () => {
    const original = buildCustomer();
    const doc = CustomerMapper.toPersistence(original);
    const rehydrated = CustomerMapper.toDomain(doc);
    const doc2 = CustomerMapper.toPersistence(rehydrated);

    expect(doc2).toEqual(doc);
  });
});
