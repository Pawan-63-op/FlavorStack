import { Cart } from '../entities/Cart';

// Persistence port for the Cart aggregate (Commerce Phase 3).
//
// One active cart per customer — enforced by a unique index on `customerId`
// in the Mongo implementation. `save` is upsert-style: it inserts a brand-new
// aggregate (persistedVersion === 0, no document yet) and otherwise updates
// under an optimistic-lock guard on `version`. A stale writer (version no
// longer matches the persisted document) surfaces as ConflictError.
export interface ICartRepository {
  findById(id: string): Promise<Cart | null>;
  findByCustomerId(customerId: string): Promise<Cart | null>;
  save(cart: Cart): Promise<void>;
  delete(id: string): Promise<void>;
}
