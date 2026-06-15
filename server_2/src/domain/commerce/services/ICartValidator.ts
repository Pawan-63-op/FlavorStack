import { Result } from '../../shared/Result';
import { Cart } from '../entities/Cart';
import { CommerceCatalogRestaurantView } from '../types/CommerceCatalogView';
import { ValidationReport } from '../types/ValidationReport';

// Pure, stateless cart-time validator (Commerce Phase 6) — no I/O.
// `catalogView` is the commerce_catalog_view entry for `cart.restaurantId`
// (null if the cart is empty or the projection has no entry for that restaurant);
// callers fetch it via ICommerceCatalogReadRepository.findRestaurantView.
//
// Checks: restaurant active/visible/open, item available, variant valid,
// min-order (best-effort warning). Quantity bounds are enforced by the Quantity
// VO (Phase 2) and are not re-checked here.
export interface ICartValidator {
  validate(cart: Cart, catalogView: CommerceCatalogRestaurantView | null): Result<ValidationReport>;
}
