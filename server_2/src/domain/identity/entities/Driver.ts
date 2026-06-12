// src/modules/user/domain/entities/Driver.ts

import { BaseUser } from './BaseUser'
import { DRIVER_STATUS, DriverStatus } from '../enums/driver-status.enum'
import { GeoPoint } from '../value-objects/GeoPoint.vo'
import { VehicleInfo } from '../value-objects/VehicleInfo.vo'
import { USER_ROLE } from '../enums/user-role.enum'
import { CreateDriverInput } from '../types/CreateDriverInput'

// Imports added for Batch 4
import { DomainError } from '../../shared/errors/DomainError';
import { ValidationError } from '../../shared/errors/ValidationError';
import { ForbiddenError } from '../../shared/errors/ForbiddenError';
import { UserRegistered } from '../events/UserRegistered';
import { DriverVerified } from '../events/DriverVerified';
import { DriverSuspended } from '../events/DriverSuspended';

export class Driver extends BaseUser {
    // Verification
    driverStatus: DriverStatus

    //vehicle info
    vehicle!: VehicleInfo
    //location
    currentLocation: GeoPoint | null
    locationUpdatedAt!: Date | null
    // availability
    isAvailable: boolean
    activeOrderId: string | null
    // earnings
    totalEarnings: number
    pendingPayout: number
    stripeAccountId: string | null
    // ratings
    averageRating: number
    totalDeliveries: number
    totalRatings: number
    // notifications
    fcmTokens: string[]

    constructor(data: Partial<Driver>) {
        super(data)
        this.role = USER_ROLE.DRIVER
        this.driverStatus = data.driverStatus ?? DRIVER_STATUS.PENDING_VERIFICATION
        this.vehicle = data.vehicle as VehicleInfo
        this.locationUpdatedAt = data.locationUpdatedAt ?? null
        this.isAvailable = data.isAvailable ?? false
        this.totalEarnings = data.totalEarnings ?? 0
        this.pendingPayout = data.pendingPayout ?? 0
        this.averageRating = data.averageRating ?? 0
        this.totalDeliveries = data.totalDeliveries ?? 0
        this.totalRatings = data.totalRatings ?? 0
        this.fcmTokens = data.fcmTokens ?? []
        this.activeOrderId = data.activeOrderId ?? null
        this.currentLocation = data.currentLocation ?? null
        this.stripeAccountId = data.stripeAccountId ?? null
    }

    // ── Abstract ──────────────────────────────────────────
    get displayName() { return `${this.name} (Driver)` }

    // ── Virtuals ──────────────────────────────────────────
    get isVerified() {
        return (
            this.driverStatus !== DRIVER_STATUS.PENDING_VERIFICATION &&
            this.driverStatus !== DRIVER_STATUS.SUSPENDED
        );
    }
    get isBusy() { return this.activeOrderId != null }
    get isOnline() { return this.isAvailable && this.driverStatus === DRIVER_STATUS.ACTIVE }
    get earningsFormatted() { return `₹${(this.totalEarnings / 100).toFixed(2)}` }

    // ── Availability ──────────────────────────────────────
    goOnline() {
        if (!this.isVerified) {
            throw new ForbiddenError('driver_not_verified');
        }
        if (this.driverStatus === DRIVER_STATUS.ACTIVE) {
            return;
        }
        this.isAvailable = true
        this.driverStatus = DRIVER_STATUS.ACTIVE
    }

    goOffline() {
        if (this.isBusy) {
            throw new DomainError('driver_busy_cannot_go_offline');
        }
        this.isAvailable = false
        this.driverStatus = DRIVER_STATUS.OFFLINE
    }

    updateLocation(pt: GeoPoint) {
        this.currentLocation = pt
    }

    // ── Order lifecycle ───────────────────────────────────
    assignOrder(orderId: string) {
        if (this.isBusy) {
            throw new DomainError('driver_already_busy');
        }
        if (!this.isOnline) {
            throw new DomainError('driver_not_online');
        }
        this.activeOrderId = orderId
        this.driverStatus = DRIVER_STATUS.ON_DELIVERY
    }

    cancelDelivery() {
        if (!this.isBusy) {
            throw new DomainError('driver_not_on_delivery');
        }
        this.activeOrderId = null
        this.driverStatus = DRIVER_STATUS.ACTIVE
    }

    completeDelivery() {
        if (!this.isBusy) {
            throw new DomainError('driver_not_on_delivery');
        }
        this.activeOrderId = null
        this.driverStatus = DRIVER_STATUS.ACTIVE
        this.totalDeliveries += 1
    }

    markedPickedUp() {
        if (!this.isBusy) {
            throw new DomainError('driver_not_on_delivery');
        }
        this.driverStatus = DRIVER_STATUS.ON_DELIVERY
    }
    
    getActiveOrder() {
        return this.activeOrderId;
    }

    // ── Verification management ───────────────────────────
    verifyDriver(): void {
        // Allow both initial verification and re-verification after suspension.
        if (
            this.driverStatus === DRIVER_STATUS.PENDING_VERIFICATION ||
            this.driverStatus === DRIVER_STATUS.SUSPENDED
        ) {
            this.driverStatus = DRIVER_STATUS.OFFLINE;
            this.addDomainEvent(new DriverVerified(this._id, new Date()));
        }
    }

    suspendDriver(reason: string): void {
        this.driverStatus = DRIVER_STATUS.SUSPENDED;
        this.isAvailable = false;
        this.addDomainEvent(new DriverSuspended(this._id, reason, new Date()));
    }

    // ── Earnings methods  ──────────────────────────────────────────
    creditEarnings(amount: number) {
        if (amount <= 0) {
            throw new ValidationError('invalid_earning_amount');
        }
        this.totalEarnings += amount
        this.pendingPayout += amount
    }
    
    requestPayout(): void {

    }
    
    clearPendingPayout() { this.pendingPayout = 0 }

    // ── Ratings ───────────────────────────────────────────
    receiveRating(rating: number) {
        if (rating < 1 || rating > 5) {
            throw new ValidationError('invalid_rating');
        }
        this.totalRatings += 1
        this.averageRating = ((this.averageRating * (this.totalRatings - 1)) + rating) / this.totalRatings
    }

    // ── FCM tokens ────────────────────────────────────────
    registerFcmToken(token: string) {
        if (!this.fcmTokens.includes(token)) this.fcmTokens.push(token)
    }

    removeFcmToken(token: string) {
        this.fcmTokens = this.fcmTokens.filter(t => t !== token)
    }

    // ── Static factory ────────────────────────────────────
    static create(input: CreateDriverInput): Driver {
        const driver = new Driver({
            ...input,
            role: USER_ROLE.DRIVER,
            driverStatus: DRIVER_STATUS.PENDING_VERIFICATION,
            isActive: true,
            isEmailVerified: false,
            loginAttempts: 0,
            tokenVersion: 0,
            isAvailable: false,
            totalEarnings: 0,
            pendingPayout: 0,
            averageRating: 0,
            totalDeliveries: 0,
            totalRatings: 0,
            fcmTokens: [],
        });

        driver.addDomainEvent(
            new UserRegistered(driver._id, driver.email, driver.role, driver.name)
        );

        return driver;
    }
};
