import { Admin } from '../../../domain/identity/entities/Admin';
import { AdminDocument, PermissionDocument, AuditEntryDocument } from '../models/AdminModel';
import { Permission } from '../../../domain/identity/value-objects/Permission.vo';
import { AuditEntry } from '../../../domain/identity/value-objects/AuditEntry.vo';
import { baseToDomain, baseToPersistence, rebuildOrThrow } from './BaseUserMapper';

export class AdminMapper {
  static toPersistence(admin: Admin): AdminDocument {
    return {
      ...baseToPersistence(admin),
      department: admin.department,
      isSuperAdmin: admin.isSuperAdmin,
      managedBy: admin.managedBy ? admin.managedBy : null,
      permissions: admin.permissions.map(permissionToPersistence),
      twoFactorEnabled: admin.twoFactorEnabled,
      twoFactorSecret: admin.twoFactorSecret,
      auditLog: admin.auditLog.map(auditEntryToPersistence),
      lastActivityAt: admin.lastActivityAt,
    };
  }

  static toDomain(doc: AdminDocument): Admin {
    const admin = new Admin({
      ...baseToDomain(doc),
      department: doc.department,
      isSuperAdmin: doc.isSuperAdmin,
      managedBy: doc.managedBy ?? '',
      permissions: doc.permissions.map((permission) => permissionToDomain(permission, doc._id)),
      twoFactorEnabled: doc.twoFactorEnabled,
      twoFactorSecret: doc.twoFactorSecret,
      auditLog: doc.auditLog.map(auditEntryToDomain),
      lastActivityAt: doc.lastActivityAt,
    });
    admin.clearDomainEvents();
    return admin;
  }
}

function permissionToPersistence(permission: Permission): PermissionDocument {
  return {
    resource: permission.resource,
    action: permission.action,
    scope: permission.scope,
  };
}

function permissionToDomain(doc: PermissionDocument, adminId: string): Permission {
  return rebuildOrThrow(
    Permission.create({ resource: doc.resource, action: doc.action, scope: doc.scope }),
    `Admin permission (${adminId})`
  );
}

function auditEntryToPersistence(entry: AuditEntry): AuditEntryDocument {
  return {
    action: entry.action,
    targetModel: entry.targetModel,
    targetId: entry.targetId,
    meta: entry.meta as Record<string, unknown>,
    performedAt: entry.performedAt,
    details: entry.details,
    ipAddress: entry.ipAddress,
  };
}

function auditEntryToDomain(doc: AuditEntryDocument): AuditEntry {
  return {
    action: doc.action,
    targetModel: doc.targetModel ?? '',
    targetId: doc.targetId ?? '',
    meta: doc.meta ?? {},
    performedAt: doc.performedAt,
    details: doc.details ?? '',
    ipAddress: doc.ipAddress ?? '',
  };
}
