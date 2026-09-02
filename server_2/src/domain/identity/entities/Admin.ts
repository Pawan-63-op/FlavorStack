
import { BaseUser } from './BaseUser'
import { USER_ROLE, UserRole } from '../enums/user-role.enum'
import { Permission } from '../value-objects/Permission.vo'
import { PermissionAction, PERMISSION_ACTION } from '../enums/permission-action.enum'
import { PermissionResource, PERMISSION_RESOURCE } from '../enums/permission-resource.enum'
import { AuditEntry } from '../value-objects/AuditEntry.vo'
import { CreateAdminInput } from '../types/CreateAdminInput'

import { ForbiddenError } from '../../shared/errors/ForbiddenError';
import { UserRegistered } from '../events/UserRegistered';

export class Admin extends BaseUser {
    department: string
    isSuperAdmin!: boolean
    managedBy!: string

    permissions: Permission[]

    twoFactorEnabled: boolean
    twoFactorSecret: string | null
    
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

    get displayName() { return `${this.name} (Admin)` }

    get isFullAccess() { return this.isSuperAdmin }
    get permissionSummary() { return this.permissions.map(p => p.toString()) }

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

    grantPermission(p: Permission) {
        const exists = this.permissions.some(ep => ep.matches(p.resource, p.action))
        if (!exists) {
            this.permissions.push(p)
        }
    }

    revokePermission(resource: PermissionResource, action: PermissionAction) {
        this.permissions = this.permissions.filter(p => !p.matches(resource, action))
    }

    grantFullAccess() { this.isSuperAdmin = true }
    
    revokeAllPermissions() { this.permissions = []; this.isSuperAdmin = false }

    assertCanBan(targetRole: UserRole) {
        if (targetRole === USER_ROLE.ADMIN && !this.isSuperAdmin) {
            throw new ForbiddenError('Only super admins can ban other admins');
        }
    }

    /** Authorises the actor to move a user onto `targetRole`; the caller applies the change. */
    assignRole(targetRole: UserRole): void {
        this.assertPermission(PERMISSION_RESOURCE.USER, PERMISSION_ACTION.UPDATE);
        if (targetRole === USER_ROLE.ADMIN && !this.isSuperAdmin) {
            throw new ForbiddenError('Only super admins can assign the admin role');
        }
    }

    enable2FA(secret: string) {
        this.twoFactorSecret = secret
        this.twoFactorEnabled = true
    }

    disable2FA() {
        this.twoFactorSecret = null
        this.twoFactorEnabled = false
    }

    logAction(action: string, meta: object) {
        this.auditLog.push({
            action,
            meta,
            performedAt: new Date(),
        } as AuditEntry)
        this.lastActivityAt = new Date()
    }

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
