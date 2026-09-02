
import { BaseUser } from './BaseUser'
import { USER_ROLE } from "../enums/user-role.enum";
import { LOYALTY_TIER, LoyaltyTier } from "../enums/loyalty-tier.enum";
import { Address } from "../value-objects/Address.vo";
import { randomUUID } from 'crypto';
import { WalletTransaction } from '../value-objects/WalletTransaction.vo';
import { CreateCustomerInput } from '../types/CreateCustomerInput';

import { Money } from '../../shared/Money';
import { DomainError } from '../../shared/errors/DomainError';
import { ValidationError } from '../../shared/errors/ValidationError';
import { NotFoundError } from '../../shared/errors/NotFoundError';
import { UserRegistered } from '../events/UserRegistered';

export interface CustomerAddress {
    id: string;
    address: Address;
}

export class Customer extends BaseUser {

    addresses!: CustomerAddress[]
    defaultAddressId!: string | null

    walletBalance!: number
    walletCurrency!: string
    walletTransactions!: WalletTransaction[]

    loyaltyPoints!: number
    totalLifetimeSpend!: number

    referralCode!: string
    referredBy!: string | null
    referralCount!: number

    savedRestaurants!: string[]
    dietaryPreferences!: string[]
    defaultPaymentMethod!: string | null

    notificationsEnabled!: boolean

    constructor(data: Partial<Customer>) {
        super(data)
        this.role = USER_ROLE.CUSTOMER
        this.walletBalance = data.walletBalance ?? 0
        this.walletCurrency = data.walletCurrency ?? "INR"
        this.walletTransactions = data.walletTransactions ?? []
        this.loyaltyPoints = data.loyaltyPoints ?? 0
        this.totalLifetimeSpend = data.totalLifetimeSpend ?? 0
        this.referralCount = data.referralCount ?? 0
        this.referralCode = data.referralCode ?? ''
        this.referredBy = data.referredBy ?? null
        this.addresses = data.addresses ?? []
        this.defaultAddressId = data.defaultAddressId ?? null
        this.savedRestaurants = data.savedRestaurants ?? []
        this.dietaryPreferences = data.dietaryPreferences ?? []
        this.notificationsEnabled = data.notificationsEnabled ?? true
    }

    get displayName(): string {
        return this.name
    }

    get loyaltyTier(): LoyaltyTier {
        if (this.totalLifetimeSpend >= 15000) return LOYALTY_TIER.PLATINUM
        if (this.totalLifetimeSpend >= 5000) return LOYALTY_TIER.GOLD
        if (this.totalLifetimeSpend >= 1000) return LOYALTY_TIER.SILVER
        return LOYALTY_TIER.BRONZE
    }

    get defaultAddress(): Address | null {
        if (!this.defaultAddressId) return null;
        const entry = this.addresses.find(a => a.id === this.defaultAddressId);
        return entry ? entry.address : null;
    }

    get walletFormatted(): string {
        return `₹${(this.walletBalance / 100).toFixed(2)}`
    }

    addAddress(addr: Address): string {
        const id = randomUUID();
        this.addresses.push({ id, address: addr });
        if (!this.defaultAddressId) {
            this.defaultAddressId = id;
        }
        return id;
    }

    updateAddress(addrId: string, addr: Address): void {
        const entry = this.addresses.find(a => a.id === addrId);
        if (!entry) {
            throw new NotFoundError('address_not_found');
        }
        entry.address = addr;
    }

    removeAddress(addrId: string): void {
        this.addresses = this.addresses.filter(a => a.id !== addrId);
        if (this.defaultAddressId === addrId) {
            this.defaultAddressId = this.addresses.length > 0 ? this.addresses[0].id : null;
        }
    }

    setDefaultAddress(addrId: string): void {
        const exists = this.addresses.some(a => a.id === addrId);
        if (exists) {
            this.defaultAddressId = addrId;
        }
    }

    deductwallet(amount: number): void {
        const currentBalanceResult = Money.create(this.walletBalance, this.walletCurrency);
        const deductAmountResult = Money.create(amount, this.walletCurrency);

        if (currentBalanceResult.isFailure) {
            throw currentBalanceResult.getError();
        }
        if (deductAmountResult.isFailure) {
            throw deductAmountResult.getError();
        }

        const balance = currentBalanceResult.getValue();
        const deduct = deductAmountResult.getValue();

        const newBalanceResult = balance.subtract(deduct);
        if (newBalanceResult.isFailure) {
            throw new DomainError('insufficient_balance');
        }

        this.walletBalance = newBalanceResult.getValue().amount;
    }

    creditLoyaltyPoints(pts: number): void {
        if (pts < 0) {
            throw new ValidationError('Loyalty points to credit cannot be negative');
        }
        this.loyaltyPoints += pts;
    }

    redeemLoyaltyPoints(pts: number): void {
        if (pts < 0) {
            throw new ValidationError('Loyalty points to redeem cannot be negative');
        }
        if (this.loyaltyPoints < pts) {
            throw new DomainError('insufficient_points');
        }
        this.loyaltyPoints -= pts;
    }

    canReview() {

    }
    
    static create(input: CreateCustomerInput): Customer {
        const defaultAddressId = input.defaultAddress ? randomUUID() : null;
        const addresses: CustomerAddress[] = [];
        if (input.defaultAddress) {
            addresses.push({ id: defaultAddressId!, address: input.defaultAddress });
        }
        const { defaultAddress: _addr, ...inputWithoutAddress } = input;
        const customer = new Customer({
            ...inputWithoutAddress,
            role: USER_ROLE.CUSTOMER,
            isActive: true,
            isEmailVerified: false,
            loginAttempts: 0,
            tokenVersion: 0,
            walletBalance: 0,
            loyaltyPoints: 0,
            totalLifetimeSpend: 0,
            referralCount: 0,
            addresses,
            defaultAddressId,
            savedRestaurants: [],
        });

        customer.addDomainEvent(
            new UserRegistered(customer._id, customer.email, customer.role, customer.name)
        );

        return customer;
    }
};
