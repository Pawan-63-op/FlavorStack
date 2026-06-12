// Mongoose discriminator — `users` collection, role: CUSTOMER.
// Implements the persisted shape of Customer (src/domain/identity/entities/Customer.ts).
import { Schema } from 'mongoose';
import { UserModel, UserDocument } from './UserModel';
import { USER_ROLE } from '../../../domain/identity/enums/user-role.enum';

export interface CustomerAddressDocument {
  id: string;
  label?: string;
  street: string;
  city: string;
  state: string;
  pinCode: string;
  coordinates: { lat: number; lng: number };
}

// Mirrors WalletTransaction.vo.ts, but with `txId` as a primitive string
// (the VO declares it as the boxed `String` type — see Phase 6 plan §16, gap 7).
export interface WalletTransactionDocument {
  txId: string;
  type: string;
  amount: number;
  currency: string;
  source: string;
  referenceId: string;
  createdAt: Date;
}

export interface CustomerDocument extends UserDocument {
  addresses: CustomerAddressDocument[];
  defaultAddressId: string | null;
  walletBalance: number;
  walletCurrency: string;
  walletTransactions: WalletTransactionDocument[];
  loyaltyPoints: number;
  totalLifetimeSpend: number;
  referralCode: string;
  referredBy: string | null;
  referralCount: number;
  savedRestaurants: string[];
  dietaryPreferences: string[];
  defaultPaymentMethod: string | null;
  fcmTokens: string[];
  notificationsEnabled: boolean;
}

const AddressSchema = new Schema<CustomerAddressDocument>(
  {
    id: { type: String, required: true },
    label: { type: String },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pinCode: { type: String, required: true },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
  },
  { _id: false }
);

const WalletTransactionSchema = new Schema<WalletTransactionDocument>(
  {
    txId: { type: String, required: true },
    type: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    source: { type: String, required: true },
    referenceId: { type: String, required: true },
    createdAt: { type: Date, required: true },
  },
  { _id: false }
);

const CustomerSchema = new Schema<CustomerDocument>({
  addresses: { type: [AddressSchema], default: [] },
  defaultAddressId: { type: String, default: null },
  walletBalance: { type: Number, default: 0 },
  walletCurrency: { type: String, default: 'INR' },
  walletTransactions: { type: [WalletTransactionSchema], default: [] },
  loyaltyPoints: { type: Number, default: 0 },
  totalLifetimeSpend: { type: Number, default: 0 },
  referralCode: { type: String, default: '' },
  referredBy: { type: String, default: null },
  referralCount: { type: Number, default: 0 },
  savedRestaurants: { type: [String], default: [] },
  dietaryPreferences: { type: [String], default: [] },
  defaultPaymentMethod: { type: String, default: null },
  fcmTokens: { type: [String], default: [] },
  notificationsEnabled: { type: Boolean, default: true },
});

// referralCode is generated (8-char UUID slice) at registration — see RegisterCustomer use case.
CustomerSchema.index({ referralCode: 1 }, { unique: true, sparse: true });

export const CustomerModel = UserModel.discriminator<CustomerDocument>(USER_ROLE.CUSTOMER, CustomerSchema);
