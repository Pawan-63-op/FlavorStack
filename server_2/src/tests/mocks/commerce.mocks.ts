import { Cart } from '../../domain/commerce/entities/Cart';
import { ICartRepository } from '../../domain/commerce/repositories/ICartRepository';
import { ConflictError } from '../../domain/shared/errors/ConflictError';

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
