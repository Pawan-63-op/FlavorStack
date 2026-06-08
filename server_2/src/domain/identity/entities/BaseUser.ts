
// src/modules/user/domain/entities/BaseUser.ts
// src/modules/user/domain/entities/BaseUser.ts:

import { UserRole } from "../enums/user-role.enum";
import { AuthProvider } from "../enums/auth-provider.enum";
export abstract class BaseUser {

    // ── Section 1: Identity ──────────────────────────────
    _id!: string
    name!: string
    email!: string
    phone!: string
    avatarUrl!: string
    role!: UserRole

    // ── Section 2: Auth credentials ──────────────────────
    passwordHash!: string
    authProvider!: AuthProvider
    providerId!: string

    // ── Section 3: Email verification ────────────────────
    isEmailVerified!: boolean
    emailOtp!: string | null
    emailOtpExpiresAt!: Date | null

    // ── Section 4: Password reset ─────────────────────────
    resetPasswordOtp!: string | null
    resetPasswordOtpExpiresAt!: Date | null
    passwordChangedAt!: Date | null

    // ── Section 5: Session tracking ──────────────────────
    refreshTokenHash!: string | null
    sessionId!: string | null
    tokenVersion!: number

    // ── Section 6: Security ───────────────────────────────
    loginAttempts!: number
    lockUntil!: Date | null
    lastLoginAt!: Date | null
    lastLoginIp!: string | null
    isBanned!: boolean
    banReason!: string | null

    // ── Section 7: Soft delete + concurrency ─────────────
    isActive!: boolean
    deletedAt!: Date | null
    version!: number
    createdAt!: Date
    updatedAt!: Date

    constructor(data: Partial<BaseUser>) {
        Object.assign(this, data)
    }

    // ── Abstract — each subclass must implement ───────────
    abstract get displayName(): string

    // ── Virtuals — computed, never stored ─────────────────
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

    // ── Auth rules — pure logic, no crypto here ───────────
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
        this.refreshTokenHash = null
        this.sessionId = null

    }
};





























































































































































































































































































































































