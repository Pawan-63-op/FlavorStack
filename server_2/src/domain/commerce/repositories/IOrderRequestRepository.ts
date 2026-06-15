import { OrderRequest } from '../entities/OrderRequest';

// Persistence port for the OrderRequest aggregate (Commerce Phase 11, commerce_module.md §3.4/§6).
//
// OrderRequest is write-once / append-only: once created at checkout it is never mutated, so there is
// no `update`/`delete`. `save` persists a brand-new aggregate inside the checkout transaction (alongside
// the outbox rows). `findByIdempotencyKey` backs the checkout idempotency guard (§4.4 step 0): a repeated
// Idempotency-Key returns the original OrderRequest rather than creating a duplicate. The unique
// `order_requests.idempotencyKey` index is the persistence-level enforcement of the same invariant — Phase 12
// ratified this single index as the guard rather than introducing a separate `commerce_idempotency` collection.
export interface IOrderRequestRepository {
  findById(id: string): Promise<OrderRequest | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<OrderRequest | null>;
  save(orderRequest: OrderRequest): Promise<void>;
}
