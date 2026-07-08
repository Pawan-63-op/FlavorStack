import { Result } from '../../shared/Result';
import { Cart } from '../entities/Cart';
import { CommerceCatalogRestaurantView } from '../types/CommerceCatalogView';
import { ValidationReport } from '../types/ValidationReport';

export interface ICartValidator {
  validate(cart: Cart, catalogView: CommerceCatalogRestaurantView | null): Result<ValidationReport>;
}
