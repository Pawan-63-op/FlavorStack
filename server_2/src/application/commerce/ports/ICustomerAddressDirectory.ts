import { Address } from '../../../domain/identity/value-objects/Address.vo';

/**
 * Commerce's read of the customer's server-backed address book (Identity's `Customer`
 * aggregate, G12). Checkout resolves the delivery address through this rather than
 * trusting a client-supplied one, so the coordinates the delivery fee is computed from
 * are the ones the customer actually saved.
 */
export interface ICustomerAddressDirectory {
  /**
   * The saved address `addressId` belonging to `customerId`, or null when the customer
   * has no such address (including when the caller is not a customer at all). Never
   * resolves another customer's address — ownership is part of the lookup.
   */
  getAddress(customerId: string, addressId: string): Promise<Address | null>;
}
