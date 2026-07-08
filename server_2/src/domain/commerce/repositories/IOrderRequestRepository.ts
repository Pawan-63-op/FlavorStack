import { OrderRequest } from '../entities/OrderRequest';

export interface IOrderRequestRepository {
  findById(id: string): Promise<OrderRequest | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<OrderRequest | null>;
  save(orderRequest: OrderRequest): Promise<void>;
}
