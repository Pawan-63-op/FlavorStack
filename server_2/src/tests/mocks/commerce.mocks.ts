import { Cart } from '../../domain/commerce/entities/Cart';
import { ICartRepository } from '../../domain/commerce/repositories/ICartRepository';
import { ConflictError } from '../../domain/shared/errors/ConflictError';
import { Address } from '../../domain/identity/value-objects/Address.vo';
import { ICustomerAddressDirectory } from '../../application/commerce/ports/ICustomerAddressDirectory';
import { DeliveryAddressResolver } from '../../application/commerce/services/DeliveryAddressResolver';

/**
 * In-memory ICartRepository for unit tests. Mirrors MongoCartRepository's
 * optimistic-concurrency contract: `save` rejects with ConflictError when
 * `cart.persistedVersion` no longer matches the stored version.
 */
export class InMemoryCartRepository implements ICartRepository {
  private byId = new Map<string, Cart>();
  private storedVersion = new Map<string, number>();

  async findById(id: string): Promise<Cart | null> {
    const cart = this.byId.get(id);
    return cart ? this.reconstitute(cart) : null;
  }

  async findByCustomerId(customerId: string): Promise<Cart | null> {
    for (const cart of this.byId.values()) {
      if (cart.customerId === customerId) return this.reconstitute(cart);
    }
    return null;
  }

  private reconstitute(cart: Cart): Cart {
    return Cart.reconstitute(
      {
        customerId: cart.customerId,
        restaurantId: cart.restaurantId,
        items: cart.items,
        currency: cart.currency,
        appliedPromotion: cart.appliedPromotion,
        version: cart.version,
        createdAt: cart.createdAt,
        updatedAt: cart.updatedAt,
      },
      cart.id
    );
  }

  async save(cart: Cart): Promise<void> {
    const id = cart.id.toString();
    const existingVersion = this.storedVersion.get(id);

    if (existingVersion !== undefined && existingVersion !== cart.persistedVersion) {
      throw new ConflictError('Optimistic lock conflict: cart was modified or removed concurrently', {
        id,
        expectedVersion: cart.persistedVersion,
      });
    }

    this.byId.set(id, cart);
    this.storedVersion.set(id, cart.version);
  }

  async delete(id: string): Promise<void> {
    this.byId.delete(id);
    this.storedVersion.delete(id);
  }
}

/**
 * In-memory `ICustomerAddressDirectory` for unit tests. Seeded with
 * `customerId → addressId → Address`, so a lookup for the wrong customer resolves
 * `null` exactly as the real directory does.
 */
export class InMemoryCustomerAddressDirectory implements ICustomerAddressDirectory {
  private byCustomer = new Map<string, Map<string, Address>>();

  seed(customerId: string, addressId: string, address: Address): void {
    const forCustomer = this.byCustomer.get(customerId) ?? new Map<string, Address>();
    forCustomer.set(addressId, address);
    this.byCustomer.set(customerId, forCustomer);
  }

  async getAddress(customerId: string, addressId: string): Promise<Address | null> {
    return this.byCustomer.get(customerId)?.get(addressId) ?? null;
  }
}

/** A `DeliveryAddressResolver` over a directory holding `addressId → address` for one customer. */
export function makeAddressResolver(
  seeds: Array<{ customerId: string; addressId: string; address: Address }> = []
): { resolver: DeliveryAddressResolver; directory: InMemoryCustomerAddressDirectory } {
  const directory = new InMemoryCustomerAddressDirectory();
  for (const seed of seeds) directory.seed(seed.customerId, seed.addressId, seed.address);
  return { resolver: new DeliveryAddressResolver(directory), directory };
}
