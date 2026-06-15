// Shared checkout read/price assembly (Commerce Phase 11, commerce_module.md §4.4 steps 1-5).
//
// Turns a Cart + delivery point into an authoritative, recomputed PricingContext by composing the three
// checkout-time sources, each used for exactly what it is the source of truth for:
//   - Catalog ACL (ICatalogGateway, Phase 10): restaurant existence/status/open, item base price/availability,
//     serviceability + RESOLVED delivery fee + min order. Authoritative at the commit moment (invariant 4).
//   - Commerce-local projection (ICommerceCatalogReadRepository, Phase 5): variant option price-deltas +
//     availability — the ACL deliberately does not expose these (see CatalogGatewayRead scope note).
//   - Commerce pricing policy (CommercePricingPolicy): platform/packaging fees + tax rate (not Catalog data).
//
// Delivery fee: the ACL returns the *resolved* fee (it has already applied tier + free-above logic), so we
// model it as a single covering tier on the PricingContext. This keeps the pure pricing pipeline the sole
// breakdown assembler AND guarantees PreviewCheckout and Checkout produce identical pricing by construction
// (Phase 13 "preview matches checkout pricing").
//
// Both PreviewCheckout (Phase 11 Batch 3) and Checkout (Batch 4) call assemble(); Checkout additionally turns
// the returned `resolvedLines` + `restaurant` into immutable snapshots. This service performs I/O but holds no
// state and imports no infrastructure — it depends only on domain ports.
import { Result } from '../../../domain/shared/Result';
import { Money } from '../../../domain/shared/Money';
import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';
import { ValidationError } from '../../../domain/shared/errors/ValidationError';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ConflictError } from '../../../domain/shared/errors/ConflictError';
import { Cart } from '../../../domain/commerce/entities/Cart';
import { Quantity } from '../../../domain/commerce/value-objects/Quantity';
import { AppliedPromotion } from '../../../domain/commerce/value-objects/AppliedPromotion';
import { ICatalogGateway } from '../../../domain/commerce/services/ICatalogGateway';
import { ICommerceCatalogReadRepository } from '../../../domain/commerce/repositories/ICommerceCatalogReadRepository';
import { IPromotionService } from '../../../domain/commerce/services/IPromotionService';
import { SubtotalStage } from '../../../domain/commerce/services/pricing/SubtotalStage';
import { PricingContext, PricingLineInput } from '../../../domain/commerce/types/PricingContext';
import { CommercePricingPolicy } from '../../../domain/commerce/types/CommercePricingPolicy';
import { CheckoutRestaurant, CheckoutServiceability } from '../../../domain/commerce/types/CatalogGatewayRead';
import { COMMERCE_RESTAURANT_STATUS } from '../../../domain/commerce/enums/restaurant-status.enum';

export interface ResolvedCheckoutOption {
  optionId: string;
  label: string;
  priceDelta: Money;
}

export interface ResolvedCheckoutLine {
  menuItemId: string;
  name: string;
  categoryId: string;
  basePrice: Money;
  selectedOptions: ResolvedCheckoutOption[];
  quantity: Quantity;
}

export interface CheckoutAssembly {
  restaurant: CheckoutRestaurant;
  serviceability: CheckoutServiceability;
  resolvedLines: ResolvedCheckoutLine[];
  subtotal: Money;
  promotion: AppliedPromotion | null;
  pricingContext: PricingContext;
}

export class CheckoutContextAssembler {
  constructor(
    private readonly catalogGateway: ICatalogGateway,
    private readonly catalogReadRepo: ICommerceCatalogReadRepository,
    private readonly promotionService: IPromotionService,
    private readonly pricingPolicy: CommercePricingPolicy
  ) {}

  async assemble(cart: Cart, deliveryPoint: GeoPoint): Promise<Result<CheckoutAssembly>> {
    if (cart.isEmpty || cart.restaurantId === null) {
      return Result.fail<CheckoutAssembly>(new ValidationError('Cannot checkout an empty cart'));
    }
    const restaurantId = cart.restaurantId;

    // 1. Authoritative restaurant read — must be active and open right now.
    const restaurantResult = await this.catalogGateway.getRestaurantForCheckout(restaurantId);
    if (restaurantResult.isFailure) return Result.fail<CheckoutAssembly>(restaurantResult.getError());
    const restaurant = restaurantResult.getValue();

    if (restaurant.status !== COMMERCE_RESTAURANT_STATUS.ACTIVE) {
      return Result.fail<CheckoutAssembly>(new ConflictError('Restaurant is not available for checkout'));
    }
    if (!restaurant.isOpen) {
      return Result.fail<CheckoutAssembly>(new ConflictError('Restaurant is closed'));
    }

    // 2. Authoritative item snapshots (base price + availability), re-derived not trusted from the cart cache.
    const menuItemIds = cart.items.map((item) => item.menuItemId);
    const itemsResult = await this.catalogGateway.getItemsSnapshot(menuItemIds);
    if (itemsResult.isFailure) return Result.fail<CheckoutAssembly>(itemsResult.getError());
    const itemsById = new Map(itemsResult.getValue().map((item) => [item.menuItemId, item]));

    // 3. Projection views supply variant option price-deltas + availability (not exposed by the ACL).
    const projectionViews = await this.catalogReadRepo.findMenuItemViews(menuItemIds);
    const projectionById = new Map(projectionViews.map((view) => [view.menuItemId, view]));

    // 4. Resolve each cart line against the authoritative item + projected variants.
    const resolvedLines: ResolvedCheckoutLine[] = [];
    for (const item of cart.items) {
      const acl = itemsById.get(item.menuItemId);
      if (!acl) {
        return Result.fail<CheckoutAssembly>(new NotFoundError(`Item no longer available: ${item.menuItemId}`));
      }
      if (acl.restaurantId !== restaurantId) {
        return Result.fail<CheckoutAssembly>(
          new ConflictError(`Item ${item.menuItemId} does not belong to restaurant ${restaurantId}`)
        );
      }
      if (!acl.isAvailable) {
        return Result.fail<CheckoutAssembly>(new ConflictError(`Item is unavailable: ${item.menuItemId}`));
      }

      const optionsResult = this.resolveOptions(item.menuItemId, item.selectedOptionIds, projectionById.get(item.menuItemId));
      if (optionsResult.isFailure) return Result.fail<CheckoutAssembly>(optionsResult.getError());

      resolvedLines.push({
        menuItemId: acl.menuItemId,
        name: acl.name,
        categoryId: acl.categoryId,
        basePrice: acl.basePrice,
        selectedOptions: optionsResult.getValue(),
        quantity: item.quantity,
      });
    }

    // 5. Recompute the authoritative subtotal from the resolved prices.
    const pricingLines: PricingLineInput[] = resolvedLines.map((line) => ({
      menuItemId: line.menuItemId,
      basePrice: line.basePrice,
      selectedVariants: line.selectedOptions.map((o) => ({ optionId: o.optionId, priceDelta: o.priceDelta })),
      quantity: line.quantity,
    }));
    const subtotalResult = SubtotalStage.run(pricingLines);
    if (subtotalResult.isFailure) return Result.fail<CheckoutAssembly>(subtotalResult.getError());
    const subtotal = subtotalResult.getValue();

    // 6. Authoritative serviceability + resolved delivery fee + min order for the delivery point.
    const serviceabilityResult = await this.catalogGateway.checkServiceability(restaurantId, deliveryPoint, subtotal);
    if (serviceabilityResult.isFailure) return Result.fail<CheckoutAssembly>(serviceabilityResult.getError());
    const serviceability = serviceabilityResult.getValue();

    if (!serviceability.serviceable) {
      return Result.fail<CheckoutAssembly>(new ConflictError('Delivery address is not serviceable'));
    }
    if (subtotal.amount < serviceability.minOrder.amount) {
      return Result.fail<CheckoutAssembly>(
        new ValidationError(`Order subtotal is below the minimum of ${serviceability.minOrder.amount}`)
      );
    }

    // 7. Re-validate the promotion authoritatively against the fresh subtotal (recomputes the discount).
    const promotionResult = this.revalidatePromotion(cart, subtotal);
    if (promotionResult.isFailure) return Result.fail<CheckoutAssembly>(promotionResult.getError());
    const promotion = promotionResult.getValue();

    // 8. Build the PricingContext — ACL resolved delivery fee modeled as a single covering tier.
    const pricingContext: PricingContext = {
      lines: pricingLines,
      restaurantFeeInputs: {
        platformFee: this.pricingPolicy.platformFee,
        packagingFee: this.pricingPolicy.packagingFee,
      },
      deliveryInputs: {
        distanceMeters: serviceability.distanceMeters,
        feeTiers: [{ maxDistanceMeters: serviceability.distanceMeters + 1, fee: serviceability.deliveryFee }],
      },
      taxPolicy: { rate: this.pricingPolicy.taxRate },
      promotion: promotion ?? undefined,
    };

    return Result.ok<CheckoutAssembly>({
      restaurant,
      serviceability,
      resolvedLines,
      subtotal,
      promotion,
      pricingContext,
    });
  }

  private resolveOptions(
    menuItemId: string,
    selectedOptionIds: string[],
    projection: { variantGroups: { options: { optionId: string; label: string; priceDeltaAmount: number; currency: string; isAvailable: boolean }[] }[] } | undefined
  ): Result<ResolvedCheckoutOption[]> {
    if (selectedOptionIds.length === 0) return Result.ok<ResolvedCheckoutOption[]>([]);

    if (!projection) {
      return Result.fail<ResolvedCheckoutOption[]>(
        new NotFoundError(`No projected variants for item: ${menuItemId}`)
      );
    }

    const optionsById = new Map<string, { label: string; priceDeltaAmount: number; currency: string; isAvailable: boolean }>();
    for (const group of projection.variantGroups) {
      for (const option of group.options) {
        optionsById.set(option.optionId, option);
      }
    }

    const resolved: ResolvedCheckoutOption[] = [];
    for (const optionId of selectedOptionIds) {
      const option = optionsById.get(optionId);
      if (!option) {
        return Result.fail<ResolvedCheckoutOption[]>(new NotFoundError(`Variant option not found: ${optionId}`));
      }
      if (!option.isAvailable) {
        return Result.fail<ResolvedCheckoutOption[]>(new ConflictError(`Variant option is unavailable: ${optionId}`));
      }
      const priceDeltaResult = Money.create(option.priceDeltaAmount, option.currency);
      if (priceDeltaResult.isFailure) return Result.fail<ResolvedCheckoutOption[]>(priceDeltaResult.getError());

      resolved.push({ optionId, label: option.label, priceDelta: priceDeltaResult.getValue() });
    }

    return Result.ok<ResolvedCheckoutOption[]>(resolved);
  }

  private revalidatePromotion(cart: Cart, subtotal: Money): Result<AppliedPromotion | null> {
    const applied = cart.appliedPromotion;
    if (!applied) return Result.ok<AppliedPromotion | null>(null);

    const validated = this.promotionService.validate(applied.code, {
      subtotal,
      currency: subtotal.currency,
    });
    if (validated.isFailure) return Result.fail<AppliedPromotion | null>(validated.getError());
    return Result.ok<AppliedPromotion | null>(validated.getValue());
  }
}
