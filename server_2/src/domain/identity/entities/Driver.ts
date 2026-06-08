import { BaseUser } from './BaseUser'
// import { UserRole }    from '../enums/UserRole'
import { DomainError } from '../../shared/errors/DomainError'
// import { DomainError } from '../errors/DomainError'
// import {DomainErro}
import { DRIVER_STATUS, DriverStatus } from '../enums/driver-status.enum'
import { GeoPoint } from '../value-objects/GeoPoint.vo'
import { VehicleInfo } from '../value-objects/VehicleInfo.vo'
import { USER_ROLE } from '../enums/user-role.enum'
import { CreateDriverInput } from '../types/CreateDriverInput'
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
    get isVerified() { return this.driverStatus === DRIVER_STATUS.ACTIVE }
    get isBusy() { return this.activeOrderId != null }
    get isOnline() { return this.isAvailable && this.driverStatus === DRIVER_STATUS.ACTIVE }
    get earningsFormatted() { return `₹${(this.totalEarnings / 100).toFixed(2)}` }

    // ── Availability ──────────────────────────────────────
    goOnline() {
        // if (!this.isVerified) throw new DomainError('driver_not_verified')
        if (!this.isVerified) {
            console.error('Driver verification failed. Current status:', this.driverStatus)
        }
        this.isAvailable = true
        this.driverStatus = DRIVER_STATUS.ACTIVE
    }

    goOffline() {
        // if (this.isBusy) throw new DomainError('cannot_go_offline_on_active_delivery')
        if (!this.isBusy && !this.isVerified) {
            console.error('Driver is busy or it is not verified. Verification failed. Current status:', this.
                driverStatus
            )
        }
        this.isAvailable = false
        this.driverStatus = DRIVER_STATUS.OFFLINE
    }

    updateLocation(pt: GeoPoint) {
        this.currentLocation = pt
    }

    // ── Order lifecycle ───────────────────────────────────
    assignOrder(orderId: string) {
        // if (this.isBusy) throw new DomainError('driver_already_busy')
        // if (!this.isOnline) throw new DomainError('driver_not_online')
        if (this.isBusy) {
            console.error('Driver is already busy with order:', this.activeOrderId)
        }
        if (!this.isOnline) {
            console.error('Driver is not online. Current status:', this.driverStatus)
        }
        this.activeOrderId = orderId
        this.driverStatus = DRIVER_STATUS.ON_DELIVERY
    }

    cancelDelivery() {
        this.activeOrderId = null
        this.driverStatus = DRIVER_STATUS.ACTIVE
    }
    completeDelivery() {
        this.activeOrderId = null
        this.driverStatus = DRIVER_STATUS.ACTIVE
        this.totalDeliveries += 1
    }

    markedPickedUp() {
        this.driverStatus = DRIVER_STATUS.ON_DELIVERY
    }
    getActiveOrder() {
        return this.activeOrderId;
    }

    // ── Earnings methods  ──────────────────────────────────────────
    creditEarnings(amount: number) {
        // if (amount <= 0) throw new DomainError('invalid_earning_amount')
        if (amount <= 0) {
            console.error("invalid_earning_amount");
        }
        this.totalEarnings += amount
        this.pendingPayout += amount
    }
    requestPayout(): void {

    }
    clearPendingPayout() { this.pendingPayout = 0 }

    // ── Ratings ───────────────────────────────────────────
    receiveRating(rating: number) {
        // if (rating < 1 || rating > 5) throw new DomainError('invalid_rating')
        if (rating < 1 || rating > 5) {
            console.error("invalid rating");
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
        return new Driver({
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
        })
    }

};
