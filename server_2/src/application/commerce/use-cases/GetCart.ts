import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ICartRepository } from '../../../domain/commerce/repositories/ICartRepository';
import { ICommerceCatalogReadRepository } from '../../../domain/commerce/repositories/ICommerceCatalogReadRepository';
import { ICartValidator } from '../../../domain/commerce/services/ICartValidator';
import { GetCartDto } from '../dtos/GetCartDto';
import { CartResponseDto, toCartResponse } from '../dtos/CartResponseDto';
import { VALIDATION_SEVERITY } from '../../../domain/commerce/types/ValidationReport';
import { CommerceTelemetry } from '../observability/CommerceTelemetry';

// UC: GetCart — loads the customer's active Cart and returns it as a CartView, including
// an ICartValidator report (Phase 6) computed against the commerce_catalog_view projection
// and per-line enrichment (Phase 13: current name/price/availability) derived from the same
// projected restaurant view.
//
// Phase 14: each ERROR-severity validation issue increments the validation-rejection metric
// keyed by reason code, surfacing why carts are rejected at cart-time (commerce_module.md §11).
export class GetCart {
  constructor(
    private readonly cartRepo: ICartRepository,
    private readonly catalogReadRepository: ICommerceCatalogReadRepository,
    private readonly cartValidator: ICartValidator,
    private readonly telemetry: CommerceTelemetry = new CommerceTelemetry()
  ) {}

  async execute(dto: GetCartDto): Promise<Result<CartResponseDto>> {
    const cart = await this.cartRepo.findByCustomerId(dto.customerId);
    if (!cart) return Result.fail(new NotFoundError('cart_not_found'));

    const catalogView = cart.restaurantId
      ? await this.catalogReadRepository.findRestaurantView(cart.restaurantId)
      : null;

    const validationResult = this.cartValidator.validate(cart, catalogView);
    if (validationResult.isFailure) return Result.fail(validationResult.getError());

    const report = validationResult.getValue();
    for (const issue of report.issues) {
      if (issue.severity === VALIDATION_SEVERITY.ERROR) {
        this.telemetry.validationRejected(issue.code, {
          customerId: dto.customerId,
          cartId: cart.id.toString(),
          menuItemId: issue.menuItemId,
        });
      }
    }

    return Result.ok(toCartResponse(cart, report, catalogView));
  }
}
