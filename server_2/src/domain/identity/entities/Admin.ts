import { BaseUser } from './BaseUser'
import { USER_ROLE, UserRole } from '../enums/user-role.enum'
import { Permission } from '../value-objects/Permission.vo'
import { PermissionAction } from '../enums/permission-action.enum'
import { PermissionResource } from '../enums/permission-resource.enum'
import { AuditEntry } from '../value-objects/AuditEntry.vo'
import { DomainError } from '../../shared/errors/DomainError'
// import { CreateAdminDto }     from '
import { CreateAdminInput } from '../types/CreateAdminInput'
// import { Permisson} from '../value-objects/Permission.vo'
// import { PermissionAction } from '../enums/permission-action.enum'

export class Admin extends BaseUser {
    // Identity
    department: string
    isSuperAdmin!: Boolean
    managedBy!: string

    //RBAC  
    permissions: Permission[]

    // two factor auth
    twoFactorEnabled: boolean
    twoFactorSecret: string | null
    // audit

    auditLog: AuditEntry[]
    lastActivityAt: Date | null
    // 


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
        if (!this.hasPermission(resource, action))
            // throw new DomainError('permission_denied')
            console.error(`Permission denied for action "${action}" on resource "${resource}"`)
    }

    // ── Permission management ─────────────────────────────
    grantPermission(p: Permission) {
        const exists = this.permissions.some(ep => ep.matches(p.resource, p.action))
        if (!exists) this.permissions.push(p)
    }

    revokePermission(resource: PermissionResource, action: PermissionAction) {
        this.permissions = this.permissions.filter(p => !p.matches(resource, action))
    }

    grantFullAccess() { this.isSuperAdmin = true }
    revokeAllPermissions() { this.permissions = []; this.isSuperAdmin = false }

    // ── User / driver management (pure state rules) ───────
    assertCanBan(targetRole: UserRole) {
        if (targetRole === USER_ROLE.ADMIN && !this.isSuperAdmin)
            // throw new DomainError('only_superadmin_can_ban_admin')
            console.error('Only super admins can ban other admins')
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
        return new Admin({
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
        })
    }

    static createSuperAdmin(input: CreateAdminInput): Admin {
        return Admin.create({ ...input, isSuperAdmin: true })
    }
}
