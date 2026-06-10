// src/modules/user/domain/entities/Admin.ts

import { BaseUser } from './BaseUser'
import { USER_ROLE, UserRole } from '../enums/user-role.enum'
import { Permission } from '../value-objects/Permission.vo'
import { PermissionAction, PERMISSION_ACTION } from '../enums/permission-action.enum'
import { PermissionResource, PERMISSION_RESOURCE } from '../enums/permission-resource.enum'
import { AuditEntry } from '../value-objects/AuditEntry.vo'
import { CreateAdminInput } from '../types/CreateAdminInput'

// Imports added for Batch 5
import { ForbiddenError } from '../../shared/errors/ForbiddenError';
import { UserRegistered } from '../events/UserRegistered';
import { RoleAssigned } from '../events/RoleAssigned';
import { PermissionGranted } from '../events/PermissionGranted';

export class Admin extends BaseUser {
    // Identity
    department: string
    isSuperAdmin!: boolean
    managedBy!: string

    //RBAC  
    permissions: Permission[]

    // two factor auth
    twoFactorEnabled: boolean
    twoFactorSecret: string | null
    
    // audit
    auditLog: AuditEntry[]
    lastActivityAt: Date | null

    constructor(data: Partial<Admin>) {
        super(data)
        this.role = USER_ROLE.ADMIN
        this.isSuperAdmin = data.isSuperAdmin ?? false
        this.permissions = data.permissions ?? []
        this.twoFactorEnabled = data.twoFactorEnabled ?? false
        this.twoFactorSecret = data.twoFactorSecret ?? null
        this.auditLog = data.auditLog ?? []
        this.lastActivityAt = data.lastActivityAt ?? null
        this.department = data.department ?? ''
        this.managedBy = data.managedBy ?? ''
    }

    // ── Abstract ──────────────────────────────────────────
    get displayName() { return `${this.name} (Admin)` }

    // ── Virtuals ──────────────────────────────────────────
    get isFullAccess() { return this.isSuperAdmin }
    get permissionSummary() { return this.permissions.map(p => p.toString()) }

    // ── RBAC checks ───────────────────────────────────────
    hasPermission(resource: PermissionResource, action: PermissionAction): boolean {
        if (this.isSuperAdmin) return true
        return this.permissions.some(p => p.matches(resource, action))
    }

    can(action: PermissionAction, resource: PermissionResource): boolean {
        return this.hasPermission(resource, action)
    }

    assertPermission(resource: PermissionResource, action: PermissionAction) {
        if (!this.hasPermission(resource, action)) {
            throw new ForbiddenError(`Permission denied for action "${action}" on resource "${resource}"`);
        }
    }

    // ── Permission management ─────────────────────────────
    grantPermission(p: Permission) {
        const exists = this.permissions.some(ep => ep.matches(p.resource, p.action))
        if (!exists) {
            this.permissions.push(p)
            this.addDomainEvent(new PermissionGranted(this._id, p.resource, p.action, p.scope))
        }
    }

    revokePermission(resource: PermissionResource, action: PermissionAction) {
        this.permissions = this.permissions.filter(p => !p.matches(resource, action))
    }

    grantFullAccess() { this.isSuperAdmin = true }
    
    revokeAllPermissions() { this.permissions = []; this.isSuperAdmin = false }

    // ── User / driver management (pure state rules) ───────
    assertCanBan(targetRole: UserRole) {
        if (targetRole === USER_ROLE.ADMIN && !this.isSuperAdmin) {
            throw new ForbiddenError('Only super admins can ban other admins');
        }
    }

    assignRole(targetUserId: string, targetRole: UserRole): void {
        this.assertPermission(PERMISSION_RESOURCE.USER, PERMISSION_ACTION.UPDATE);
        if (targetRole === USER_ROLE.ADMIN && !this.isSuperAdmin) {
            throw new ForbiddenError('Only super admins can assign the admin role');
        }
        this.addDomainEvent(new RoleAssigned(targetUserId, targetRole, this._id));
    }

    // ── 2FA ───────────────────────────────────────────────
    enable2FA(secret: string) {
        this.twoFactorSecret = secret
        this.twoFactorEnabled = true
    }

    disable2FA() {
        this.twoFactorSecret = null
        this.twoFactorEnabled = false
    }

    // ── Audit ─────────────────────────────────────────────
    logAction(action: string, meta: object) {
        this.auditLog.push({
            action,
            meta,
            performedAt: new Date(),
        } as AuditEntry)
        this.lastActivityAt = new Date()
    }

    // ── Static factory ────────────────────────────────────
    static create(input: CreateAdminInput): Admin {
        const admin = new Admin({
            ...input,
            role: USER_ROLE.ADMIN,
            isSuperAdmin: input.isSuperAdmin ?? false,
            permissions: input.isSuperAdmin ? [] : input.permissions ?? [],
            isActive: true,
            isEmailVerified: false,
            loginAttempts: 0,
            tokenVersion: 0,
            twoFactorEnabled: false,
            auditLog: [],
        });

        admin.addDomainEvent(
            new UserRegistered(admin._id, admin.email, admin.role, admin.name)
        );

        return admin;
    }

    static createSuperAdmin(input: CreateAdminInput): Admin {
        return Admin.create({ ...input, isSuperAdmin: true })
    }
}
