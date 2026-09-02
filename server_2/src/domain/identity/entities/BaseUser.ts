
import { UserRole } from "../enums/user-role.enum";
import { AuthProvider } from "../enums/auth-provider.enum";
import { AggregateRoot } from "../../shared/AggregateRoot";
import { UniqueEntityId } from "../../shared/UniqueEntityId";

import { PasswordChanged } from "../events/PasswordChanged";

export abstract class BaseUser extends AggregateRoot<any> {

    get _id(): string {
        return this.id.toString();
    }

    name!: string
    email!: string
    phone!: string
    avatarUrl!: string
    role!: UserRole

    passwordHash!: string
    authProvider!: AuthProvider
    providerId!: string

    isEmailVerified!: boolean

    passwordChangedAt!: Date | null

    tokenVersion!: number

    loginAttempts!: number
    lockUntil!: Date | null
    lastLoginAt!: Date | null
    lastLoginIp!: string | null
    isBanned!: boolean
    banReason!: string | null

    isActive!: boolean
    deletedAt!: Date | null
    version!: number
    createdAt!: Date
    updatedAt!: Date

    constructor(data: Partial<BaseUser>) {
        const { _id: rawId, ...rest } = data as any;
        super({} as any, rawId ? new UniqueEntityId(String(rawId)) : undefined);
        Object.assign(this, rest);
        if (!this.createdAt) this.createdAt = new Date();
        if (!this.updatedAt) this.updatedAt = new Date();
    }

    abstract get displayName(): string

    get isLocked(): boolean {
        return this.lockUntil != null && this.lockUntil > new Date()
    }

    get isDeleted(): boolean {
        return this.deletedAt != null
    }

    get publicProfile() {
        return {
            id: this._id,
            name: this.name,
            email: this.email,
            role: this.role,
            avatarUrl: this.avatarUrl,
            isEmailVerified: this.isEmailVerified,
            createdAt: this.createdAt,
        }
    }

    canAttemptLogin(): boolean {
        return !this.isLocked && !this.isBanned && this.isActive
    }

    shouldLockAfterAttempt(maxAttempts = 5): boolean {
        return this.loginAttempts + 1 >= maxAttempts
    }

    recordLogin(ip: string): void {
        this.loginAttempts = 0
        this.lockUntil = null
        this.lastLoginAt = new Date()
        this.lastLoginIp = ip
    }

    incrementLoginAttempts(): void {
        this.loginAttempts += 1
    }

    lockAccount(durationMs = 15 * 60 * 1000): void {
        this.lockUntil = new Date(Date.now() + durationMs)
    }

    resetLoginAttempts(): void {
        this.loginAttempts = 0
        this.lockUntil = null
    }

    verifyEmail(): void {
        this.isEmailVerified = true;
    }

    changePassword(newPasswordHash: string): void {
        this.passwordHash = newPasswordHash;
        this.passwordChangedAt = new Date();
        this.addDomainEvent(new PasswordChanged(this._id, this.passwordChangedAt));
    }

    completePasswordReset(newPasswordHash: string): void {
        this.passwordHash = newPasswordHash;
        this.passwordChangedAt = new Date();
        this.tokenVersion += 1;
    }

    ban(reason: string): void {
        this.isBanned = true
        this.banReason = reason
        this.isActive = false
    }

    unban(): void {
        this.isBanned = false
        this.banReason = null
        this.isActive = true
    }

    incrementTokenVersion(): void {
        this.tokenVersion += 1
    }

    softDelete(): void {
        this.isActive = false
        this.deletedAt = new Date()
    }

    invalidateAllSessions(): void {
        this.tokenVersion += 1
    }

    updateProfile(fields: { name?: string; avatarUrl?: string }): void {
        if (fields.name !== undefined) this.name = fields.name
        if (fields.avatarUrl !== undefined) this.avatarUrl = fields.avatarUrl
    }
}
