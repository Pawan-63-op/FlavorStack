import { Result } from '../../shared/Result';
import { Cart } from '../entities/Cart';
import { CartCatalogView } from '../types/CatalogGatewayRead';
import { ValidationReport } from '../types/ValidationReport';

export interface ICartValidator {
  validate(cart: Cart, catalogView: CartCatalogView | null): Result<ValidationReport>;
}
