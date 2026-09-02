import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ICartRepository } from '../../../domain/commerce/repositories/ICartRepository';
import { ICatalogGateway } from '../../../domain/commerce/services/ICatalogGateway';
import { CartCatalogView } from '../../../domain/commerce/types/CatalogGatewayRead';
import { Cart } from '../../../domain/commerce/entities/Cart';
import { ICartValidator } from '../../../domain/commerce/services/ICartValidator';
import { GetCartDto } from '../dtos/GetCartDto';
import { CartResponseDto, toCartResponse } from '../dtos/CartResponseDto';
import { VALIDATION_SEVERITY } from '../../../domain/commerce/types/ValidationReport';
import { CommerceTelemetry } from '../observability/CommerceTelemetry';

export class GetCart {
  constructor(
    private readonly cartRepo: ICartRepository,
    private readonly catalogGateway: ICatalogGateway,
    private readonly cartValidator: ICartValidator,
    private readonly telemetry: CommerceTelemetry = new CommerceTelemetry()
  ) {}

  async execute(dto: GetCartDto): Promise<Result<CartResponseDto>> {
    const cart = await this.cartRepo.findByCustomerId(dto.customerId);
    if (!cart) return Result.fail(new NotFoundError('cart_not_found'));

    const viewResult = await this.loadCatalogView(cart);
    if (viewResult.isFailure) return Result.fail(viewResult.getError());
    const catalogView = viewResult.getValue();

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

  /**
   * Assembles the cart's catalog view from source of truth: the restaurant, plus only the
   * items this cart references. Items belonging to another restaurant are dropped so the
   * validator reports ITEM_NOT_FOUND — the per-restaurant projection expressed that by
   * simply not containing them.
   */
  private async loadCatalogView(cart: Cart): Promise<Result<CartCatalogView | null>> {
    const restaurantId = cart.restaurantId;
    if (restaurantId === null) return Result.ok(null);

    const restaurantResult = await this.catalogGateway.getRestaurantForCart(restaurantId);
    if (restaurantResult.isFailure) return Result.fail(restaurantResult.getError());
    const restaurant = restaurantResult.getValue();
    if (!restaurant) return Result.ok(null);

    const menuItemIds = [...new Set(cart.items.map((item) => item.menuItemId))];
    const itemsResult = await this.catalogGateway.getItemsForCart(menuItemIds);
    if (itemsResult.isFailure) return Result.fail(itemsResult.getError());

    return Result.ok<CartCatalogView>({
      ...restaurant,
      items: itemsResult.getValue().filter((item) => item.restaurantId === restaurantId),
    });
  }
}
