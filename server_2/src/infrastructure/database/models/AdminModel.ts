// Mongoose discriminator — `users` collection, role: ADMIN.
// Implements the persisted shape of Admin (src/domain/identity/entities/Admin.ts).
import { Schema } from 'mongoose';
import { UserModel, UserDocument } from './UserModel';
import { USER_ROLE } from '../../../domain/identity/enums/user-role.enum';
import { PERMISSION_RESOURCE, PermissionResource } from '../../../domain/identity/enums/permission-resource.enum';
import { PERMISSION_ACTION, PermissionAction } from '../../../domain/identity/enums/permission-action.enum';

// Mirrors Permission.vo.ts.
export interface PermissionDocument {
  resource: PermissionResource;
  action: PermissionAction;
  scope?: string;
}

// Mirrors AuditEntry.vo.ts, but only `action`/`meta`/`performedAt` are guaranteed —
// Admin.logAction() only populates those (Phase 6 plan §16, gap 6).
export interface AuditEntryDocument {
  action: string;
  targetModel?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
  performedAt: Date;
  details?: string;
  ipAddress?: string;
}

export interface AdminDocument extends UserDocument {
  department: string;
  isSuperAdmin: boolean;
  managedBy: string | null;
  permissions: PermissionDocument[];
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
  auditLog: AuditEntryDocument[];
  lastActivityAt: Date | null;
}

const PermissionSchema = new Schema<PermissionDocument>(
  {
    resource: { type: String, enum: Object.values(PERMISSION_RESOURCE), required: true },
    action: { type: String, enum: Object.values(PERMISSION_ACTION), required: true },
    scope: { type: String },
  },
  { _id: false }
);

const AuditEntrySchema = new Schema<AuditEntryDocument>(
  {
    action: { type: String, required: true },
    targetModel: { type: String },
    targetId: { type: String },
    meta: { type: Schema.Types.Mixed },
    performedAt: { type: Date, required: true },
    details: { type: String },
    ipAddress: { type: String },
  },
  { _id: false }
);

const AdminSchema = new Schema<AdminDocument>({
  department: { type: String, default: '' },
  isSuperAdmin: { type: Boolean, default: false },
  managedBy: { type: String, default: null },
  permissions: { type: [PermissionSchema], default: [] },
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String, default: null },
  auditLog: { type: [AuditEntrySchema], default: [] },
  lastActivityAt: { type: Date, default: null },
});

export const AdminModel = UserModel.discriminator<AdminDocument>(USER_ROLE.ADMIN, AdminSchema);
