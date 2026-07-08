import { randomUUID } from 'crypto';
import { Admin } from '../../../../../domain/identity/entities/Admin';
import { USER_ROLE } from '../../../../../domain/identity/enums/user-role.enum';
import { AUTH_PROVIDER } from '../../../../../domain/identity/enums/auth-provider.enum';
import { PERMISSION_RESOURCE } from '../../../../../domain/identity/enums/permission-resource.enum';
import { PERMISSION_ACTION } from '../../../../../domain/identity/enums/permission-action.enum';
import { Permission } from '../../../../../domain/identity/value-objects/Permission.vo';
import { AuditEntry } from '../../../../../domain/identity/value-objects/AuditEntry.vo';
import { AdminMapper } from '../../../../../infrastructure/database/mappers/AdminMapper';

function buildAdmin(overrides: Partial<Admin> = {}): Admin {
  const now = new Date('2024-03-01T12:00:00.000Z');

  const permissionWithScope = Permission.create({
    resource: PERMISSION_RESOURCE.ORDER,
    action: PERMISSION_ACTION.UPDATE,
    scope: 'region:pune',
  }).getValue();

  const permissionWithoutScope = Permission.create({
    resource: PERMISSION_RESOURCE.USER,
    action: PERMISSION_ACTION.READ,
  }).getValue();

  const fullAuditEntry: AuditEntry = {
    action: 'BAN_USER',
    targetModel: 'User',
    targetId: 'user-123',
    meta: { reason: 'fraud' },
    performedAt: now,
    details: 'Banned for repeated chargebacks',
    ipAddress: '127.0.0.1',
  };

  return new Admin({
    _id: randomUUID(),
    name: 'Meera Shah',
    email: 'meera@example.com',
    phone: '+919876543212',
    avatarUrl: '',
    role: USER_ROLE.ADMIN,
    passwordHash: 'hashed-password',
    authProvider: AUTH_PROVIDER.LOCAL,
    providerId: '',
    isEmailVerified: true,
    passwordChangedAt: null,
    tokenVersion: 0,
    loginAttempts: 0,
    lockUntil: null,
    lastLoginAt: now,
    lastLoginIp: '10.0.0.5',
    isBanned: false,
    banReason: null,
    isActive: true,
    deletedAt: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    department: 'Operations',
    isSuperAdmin: false,
    managedBy: 'admin-root-id',
    permissions: [permissionWithScope, permissionWithoutScope],
    twoFactorEnabled: true,
    twoFactorSecret: 'secret-123',
    auditLog: [fullAuditEntry],
    lastActivityAt: now,
    ...overrides,
  });
}

describe('AdminMapper', () => {
  it('round-trips toPersistence -> toDomain preserving base and admin fields', () => {
    const original = buildAdmin();

    const doc = AdminMapper.toPersistence(original);
    expect(doc._id).toBe(original._id);
    expect(doc.role).toBe(USER_ROLE.ADMIN);
    expect(doc.permissions).toEqual([
      { resource: PERMISSION_RESOURCE.ORDER, action: PERMISSION_ACTION.UPDATE, scope: 'region:pune' },
      { resource: PERMISSION_RESOURCE.USER, action: PERMISSION_ACTION.READ, scope: undefined },
    ]);
    expect(doc.auditLog[0]).toEqual({
      action: 'BAN_USER',
      targetModel: 'User',
      targetId: 'user-123',
      meta: { reason: 'fraud' },
      performedAt: original.auditLog[0].performedAt,
      details: 'Banned for repeated chargebacks',
      ipAddress: '127.0.0.1',
    });
    expect(doc.managedBy).toBe('admin-root-id');

    const rehydrated = AdminMapper.toDomain(doc);

    expect(rehydrated).toBeInstanceOf(Admin);
    expect(rehydrated._id).toBe(original._id);
    expect(rehydrated.role).toBe(USER_ROLE.ADMIN);
    expect(rehydrated.department).toBe(original.department);
    expect(rehydrated.isSuperAdmin).toBe(original.isSuperAdmin);
    expect(rehydrated.managedBy).toBe(original.managedBy);
    expect(rehydrated.twoFactorEnabled).toBe(original.twoFactorEnabled);
    expect(rehydrated.twoFactorSecret).toBe(original.twoFactorSecret);
    expect(rehydrated.lastActivityAt).toEqual(original.lastActivityAt);

    expect(rehydrated.permissions).toHaveLength(2);
    expect(rehydrated.permissions[0].equals(original.permissions[0])).toBe(true);
    expect(rehydrated.permissions[1].equals(original.permissions[1])).toBe(true);
    expect(rehydrated.permissions[0].scope).toBe('region:pune');
    expect(rehydrated.permissions[1].scope).toBeUndefined();

    expect(rehydrated.auditLog).toEqual(original.auditLog);
  });

  it('produces no domain events on a rehydrated aggregate', () => {
    const original = buildAdmin();
    const doc = AdminMapper.toPersistence(original);
    const rehydrated = AdminMapper.toDomain(doc);

    expect(rehydrated.pullDomainEvents()).toEqual([]);
  });

  it('toPersistence is stable across a second round-trip', () => {
    const original = buildAdmin();
    const doc = AdminMapper.toPersistence(original);
    const rehydrated = AdminMapper.toDomain(doc);
    const doc2 = AdminMapper.toPersistence(rehydrated);

    expect(doc2).toEqual(doc);
  });

  it('maps an unset managedBy (empty string) to null in persistence and back to empty string', () => {
    const original = buildAdmin({ managedBy: '' });

    const doc = AdminMapper.toPersistence(original);
    expect(doc.managedBy).toBeNull();

    const rehydrated = AdminMapper.toDomain(doc);
    expect(rehydrated.managedBy).toBe('');
  });

  it('fills gap-6 partial audit entries (logAction-style) with empty defaults on rehydration', () => {
    const original = buildAdmin();
    const doc = AdminMapper.toPersistence(original);

    const partialEntryDoc = {
      action: 'LOGIN',
      meta: { ip: '1.2.3.4' },
      performedAt: new Date('2024-03-02T00:00:00.000Z'),
    };
    doc.auditLog = [partialEntryDoc as unknown as (typeof doc.auditLog)[number]];

    const rehydrated = AdminMapper.toDomain(doc);

    expect(rehydrated.auditLog[0]).toEqual({
      action: 'LOGIN',
      targetModel: '',
      targetId: '',
      meta: { ip: '1.2.3.4' },
      performedAt: partialEntryDoc.performedAt,
      details: '',
      ipAddress: '',
    });
  });
});
