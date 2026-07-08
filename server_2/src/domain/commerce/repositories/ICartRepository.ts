import { Cart } from '../entities/Cart';

export interface ICartRepository {
  findById(id: string): Promise<Cart | null>;
  findByCustomerId(customerId: string): Promise<Cart | null>;
  save(cart: Cart): Promise<void>;
  delete(id: string): Promise<void>;
}
