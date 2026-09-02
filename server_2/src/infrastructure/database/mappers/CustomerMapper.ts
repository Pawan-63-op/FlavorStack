import { Customer, CustomerAddress } from '../../../domain/identity/entities/Customer';
import { CustomerDocument, CustomerAddressDocument, WalletTransactionDocument } from '../models/CustomerModel';
import { Address } from '../../../domain/identity/value-objects/Address.vo';
import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';
import { WalletTransaction } from '../../../domain/identity/value-objects/WalletTransaction.vo';
import { baseToDomain, baseToPersistence, rebuildOrThrow } from './BaseUserMapper';

export class CustomerMapper {
  static toPersistence(customer: Customer): CustomerDocument {
    return {
      ...baseToPersistence(customer),
      addresses: customer.addresses.map(addressEntryToPersistence),
      defaultAddressId: customer.defaultAddressId,
      walletBalance: customer.walletBalance,
      walletCurrency: customer.walletCurrency,
      walletTransactions: customer.walletTransactions.map(walletTransactionToPersistence),
      loyaltyPoints: customer.loyaltyPoints,
      totalLifetimeSpend: customer.totalLifetimeSpend,
      referralCode: customer.referralCode,
      referredBy: customer.referredBy,
      referralCount: customer.referralCount,
      savedRestaurants: customer.savedRestaurants,
      dietaryPreferences: customer.dietaryPreferences,
      defaultPaymentMethod: customer.defaultPaymentMethod,
      notificationsEnabled: customer.notificationsEnabled,
    };
  }

  static toDomain(doc: CustomerDocument): Customer {
    const customer = new Customer({
      ...baseToDomain(doc),
      addresses: doc.addresses.map(addressEntryToDomain),
      defaultAddressId: doc.defaultAddressId,
      walletBalance: doc.walletBalance,
      walletCurrency: doc.walletCurrency,
      walletTransactions: doc.walletTransactions.map(walletTransactionToDomain),
      loyaltyPoints: doc.loyaltyPoints,
      totalLifetimeSpend: doc.totalLifetimeSpend,
      referralCode: doc.referralCode,
      referredBy: doc.referredBy,
      referralCount: doc.referralCount,
      savedRestaurants: doc.savedRestaurants,
      dietaryPreferences: doc.dietaryPreferences,
      defaultPaymentMethod: doc.defaultPaymentMethod,
      notificationsEnabled: doc.notificationsEnabled,
    });
    customer.clearDomainEvents();
    return customer;
  }
}

function addressEntryToPersistence(entry: CustomerAddress): CustomerAddressDocument {
  const address = entry.address;
  return {
    id: entry.id,
    label: address.label,
    recipientName: address.recipientName,
    phone: address.phone,
    street: address.street,
    city: address.city,
    state: address.state,
    pinCode: address.pinCode,
    landmark: address.landmark,
    deliveryInstructions: address.deliveryInstructions,
    coordinates: { lat: address.coordinates.lat, lng: address.coordinates.lng },
  };
}

function addressEntryToDomain(doc: CustomerAddressDocument): CustomerAddress {
  const coordinates = rebuildOrThrow(
    GeoPoint.create(doc.coordinates.lat, doc.coordinates.lng),
    `Customer address coordinates (${doc.id})`
  );
  const address = rebuildOrThrow(
    Address.create({
      label: doc.label,
      recipientName: doc.recipientName,
      phone: doc.phone,
      street: doc.street,
      city: doc.city,
      state: doc.state,
      pinCode: doc.pinCode,
      landmark: doc.landmark,
      deliveryInstructions: doc.deliveryInstructions,
      coordinates,
    }),
    `Customer address (${doc.id})`
  );
  return { id: doc.id, address };
}

function walletTransactionToPersistence(tx: WalletTransaction): WalletTransactionDocument {
  return {
    txId: String(tx.txId),
    type: String(tx.type),
    amount: tx.amount,
    currency: tx.currency,
    source: tx.source,
    referenceId: tx.referenceId,
    createdAt: tx.createdAt,
  };
}

function walletTransactionToDomain(doc: WalletTransactionDocument): WalletTransaction {
  return {
    txId: doc.txId,
    type: doc.type,
    amount: doc.amount,
    currency: doc.currency,
    source: doc.source,
    referenceId: doc.referenceId,
    createdAt: doc.createdAt,
  };
}
