// src/modules/user/domain/entities/Customer.ts

import { BaseUser } from './BaseUser'
// import { UserRole }    from "../enums/UserRole"
// import { LoyaltyTier } from '../enums/LoyaltyTier'
// import { Address }     from '../value-objects/Address'
import { USER_ROLE } from "../enums/user-role.enum";
import { LOYALTY_TIER, LoyaltyTier } from "../enums/loyalty-tier.enum";
import { Address } from "../value-objects/Address.vo";
import { WalletTransaction } from '../value-objects/WalletTransaction.vo';
import { CreateCustomerInput } from '../types/CreateCustomerInput';
export class Customer extends BaseUser {

    // ── Customer-specific fields 
    //Addresses──────────────────────────
    addresses!: Address[]
    defaultAddressId!: string | null

    // wallet

    walletBalance!: number
    walletCurrency!: string
    walletTransactions!: WalletTransaction[]

    // Loyalty 
    loyaltyPoints!: number
    totalLifetimeSpend!: number

    // Referral
    referralCode!: string
    referredBy!: string | null
    referralCount!: number

    // Preferences
    savedRestaurants!: string[]
    dietaryPreferences!: string[]
    defaultPaymentMethod!: string | null

    // Notifications
    fcmTokens!: string[]
    notificationsEnabled!: boolean

    constructor(data: Partial<Customer>) {
        super(data)
        this.role = USER_ROLE.CUSTOMER,
            this.walletBalance = data.walletBalance ?? 0
        this.walletCurrency = data.walletCurrency ?? "INR"
        this.walletTransactions = data.walletTransactions ?? []
        this.loyaltyPoints = data.loyaltyPoints ?? 0
        this.totalLifetimeSpend = data.totalLifetimeSpend ?? 0
        this.referralCount = data.referralCount ?? 0
        this.referralCode = data.referralCode ?? ''
        this.referredBy = data.referredBy ?? null
        this.addresses = data.addresses ?? []
        this.savedRestaurants = data.savedRestaurants ?? []
        this.dietaryPreferences = data.dietaryPreferences ?? []
        this.fcmTokens = data.fcmTokens ?? []
        this.notificationsEnabled = data.notificationsEnabled ?? true
    }

    // ── Abstract implementation ───────────────────────────
    get displayName(): string {
        return this.name
    }

    // ── Virtuals ──────────────────────────────────────────
    get loyaltyTier(): LoyaltyTier {
        if (this.totalLifetimeSpend >= 15000) return LOYALTY_TIER.PLATINUM
        if (this.totalLifetimeSpend >= 5000) return LOYALTY_TIER.GOLD
        if (this.totalLifetimeSpend >= 1000) return LOYALTY_TIER.SILVER
        return LOYALTY_TIER.BRONZE
    }

    get defaultAddress(): Address | null {
        return this.addresses.find(a => a.isDefault) ?? null
    }

    get walletFormatted(): string {
        return `₹${(this.walletBalance / 100).toFixed(2)}`
    }



    // ── Address methods  ────────────────────────────────────
    addAddress(addr: Address): void {
        if (this.addresses.length === 0) addr.isDefault = true
        this.addresses.push(addr)
    }

    removeAddress(addrId: string): void {
        this.addresses = this.addresses.filter(a => a.id !== addrId);

    }
    setDefaultAddress(addrId: string): void {
        this.addresses.forEach(a => a.isDefault = a.id === addrId);
    }

    // wallet methods

    deductwallet(amount: number) {

        if (this.walletBalance < amount) {
            // if (this.walletBalance < amount) throw new DomainError('insufficient_balance')
            console.log('insufficient_balance')
        }
        this.walletBalance -= amount

    }

    // Loyalty methods
    creditLoyaltyPoints(pts: number) {
        this.loyaltyPoints += pts;
    }

    redeemLoyaltyPoints(pts: number) {
        if (this.loyaltyPoints < pts) {
            // if (this.loyaltyPoints < pts) throw new DomainError('insufficient_points')
            console.log('insufficient_points');
        }
        this.loyaltyPoints -= pts;
    }

    // review methods 
    canReview() {

    }
    // notifications methods
    registerFcmToken(token: string) { if (!this.fcmTokens.includes(token)) this.fcmTokens.push(token) }
    removeFcmToken(token: string) { this.fcmTokens = this.fcmTokens.filter(t => t !== token) }

    // import { CreateCustomerInput } from '../types/CreateCustomerInput'

    static create(input: CreateCustomerInput): Customer {
        return new Customer({
            ...input,
            role: USER_ROLE.CUSTOMER,
            isActive: true,
            isEmailVerified: false,
            loginAttempts: 0,
            tokenVersion: 0,
            walletBalance: 0,
            loyaltyPoints: 0,
            totalLifetimeSpend: 0,
            referralCount: 0,
            addresses: input.defaultAddress ? [{ ...input.defaultAddress, isDefault: true }] : [],
            savedRestaurants: [],
            fcmTokens: [],
        })
    }
};
