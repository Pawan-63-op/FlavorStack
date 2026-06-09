// src/modules/user/domain/entities/BaseUser.ts

import { UserRole } from "../enums/user-role.enum";
import { AuthProvider } from "../enums/auth-provider.enum";
import { AggregateRoot } from "../../shared/AggregateRoot";
import { UniqueEntityId } from "../../shared/UniqueEntityId";

// Import events raised by BaseUser
import { UserVerified } from "../events/UserVerified";
import { PasswordChanged } from "../events/PasswordChanged";
import { PasswordResetRequested } from "../events/PasswordResetRequested";
import { PasswordResetCompleted } from "../events/PasswordResetCompleted";
import { UserBanned } from "../events/UserBanned";
import { UserUnbanned } from "../events/UserUnbanned";

export abstract class BaseUser extends AggregateRoot<any> {

    // ── Section 1: Identity ──────────────────────────────
    // @ts-ignore
    get _id(): string {
        return this.id.toString();
    }
    // @ts-ignore
    set _id(val: string | undefined) {
        if (val) {
            (this as any)._id = new UniqueEntityId(val);
        }
    }

    name!: string
    email!: string
    phone!: string
    avatarUrl!: string
    role!: UserRole

    // ── Section 2: Auth credentials ──────────────────────
    passwordHash!: string
    authProvider!: AuthProvider
    providerId!: string

    // ── Section 3: Email verification (Redis fields removed) ──
    isEmailVerified!: boolean

    // ── Section 4: Password reset (Redis fields removed) ──────
    passwordChangedAt!: Date | null

    // ── Section 5: Session tracking (Redis fields removed) ────
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
        super(data, data._id ? new UniqueEntityId(data._id) : undefined);
        Object.assign(this, data);
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

    verifyEmail(): void {
        this.isEmailVerified = true;
        this.addDomainEvent(new UserVerified(this._id, this.email, new Date()));
    }

    changePassword(newPasswordHash: string): void {
        this.passwordHash = newPasswordHash;
        this.passwordChangedAt = new Date();
        this.addDomainEvent(new PasswordChanged(this._id, this.passwordChangedAt));
    }

    requestPasswordReset(): void {
        this.addDomainEvent(new PasswordResetRequested(this._id, this.email, new Date()));
    }

    completePasswordReset(newPasswordHash: string): void {
        this.passwordHash = newPasswordHash;
        this.passwordChangedAt = new Date();
        this.tokenVersion += 1;
        this.addDomainEvent(new PasswordResetCompleted(this._id, this.passwordChangedAt));
    }

    ban(reason: string): void {
        this.isBanned = true
        this.banReason = reason
        this.isActive = false
        this.addDomainEvent(new UserBanned(this._id, reason, new Date()));
    }

    unban(): void {
        this.isBanned = false
        this.banReason = null
        this.isActive = true
        this.addDomainEvent(new UserUnbanned(this._id, new Date()));
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
}
