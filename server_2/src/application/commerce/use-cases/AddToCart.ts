import { Result } from '../../../domain/shared/Result';
import { Money } from '../../../domain/shared/Money';
import { Cart } from '../../../domain/commerce/entities/Cart';
import { LineItemSelection } from '../../../domain/commerce/value-objects/LineItemSelection';
import { ICartRepository } from '../../../domain/commerce/repositories/ICartRepository';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IEventBus } from '../../shared/events/IEventBus';
import { AddToCartDto } from '../dtos/AddToCartDto';
import { CartResponseDto, toCartResponse } from '../dtos/CartResponseDto';
import { CommerceTelemetry } from '../observability/CommerceTelemetry';

// UC: AddToCart — adds a LineItemSelection to the customer's active Cart, creating
// one if none exists. Enforces the single-restaurant + currency invariants and
// merges identical lines (Cart.addItem). Catalog-backed validation (item available,
// variant valid, restaurant open) and authoritative pricing are Phases 5/6 — not
// yet wired, so `restaurantId` and `unitPrice` are trusted caller input for now.
//
// CartItemAdded is in-process only (not outbox-routed), published post-commit.
// Phase 14: emits the cart-add metric + a structured log line (commerce_module.md §11).
export class AddToCart {
  constructor(
    private readonly cartRepo: ICartRepository,
    private readonly unitOfWork: IUnitOfWork,
    private readonly eventBus: IEventBus,
    private readonly telemetry: CommerceTelemetry = new CommerceTelemetry()
  ) {}

  async execute(dto: AddToCartDto): Promise<Result<CartResponseDto>> {
    const selectionResult = LineItemSelection.create({
      menuItemId: dto.menuItemId,
      selectedOptionIds: dto.selectedOptionIds,
      quantity: dto.quantity,
    });
    if (selectionResult.isFailure) return Result.fail(selectionResult.getError());

    const priceResult = Money.create(dto.unitPrice.amount, dto.unitPrice.currency);
    if (priceResult.isFailure) return Result.fail(priceResult.getError());

    let cart = await this.cartRepo.findByCustomerId(dto.customerId);
    if (!cart) {
      const cartResult = Cart.create(dto.customerId);
      if (cartResult.isFailure) return Result.fail(cartResult.getError());
      cart = cartResult.getValue();
    }

    const addResult = cart.addItem(dto.restaurantId, selectionResult.getValue(), priceResult.getValue());
    if (addResult.isFailure) return Result.fail(addResult.getError());

    const events = cart.pullDomainEvents();

    await this.unitOfWork.runInTransaction(async () => {
      await this.cartRepo.save(cart!);
    });

    await this.eventBus.publishAll(events);

    this.telemetry.cartAdded({
      customerId: dto.customerId,
      restaurantId: dto.restaurantId,
      menuItemId: dto.menuItemId,
      quantity: dto.quantity,
    });

    return Result.ok(toCartResponse(cart));
  }
}
