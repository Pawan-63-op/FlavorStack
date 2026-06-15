// UC: Checkout — the core committing flow (§4.4): idempotency check → load Cart → ACL authoritative re-read →
// recompute prices via IPricingCalculator → recompute promotion → build immutable snapshots →
// OrderRequest.createFromCheckout() → unitOfWork.runInTransaction(orderRequestRepo.save + outboxStore.append)
// → post-commit eventBus.publishAll(OrderRequested, CheckoutReadyForPayment). Replay of the same
// IdempotencyKey returns the original OrderRequest unchanged.
//
// Checkout reuses the SHARED CheckoutContextAssembler + IPricingCalculator that PreviewCheckout (Batch 3)
// runs, so the priced result a customer previews is reproduced exactly at commit. The only additions here are
// the idempotency guard (§4.4 step 0), turning the assembled context into immutable snapshots, and the atomic
// persist-and-outbox + post-commit publish. The delivery point used for serviceability is the address's own
// coordinates, keeping preview (bare point) and checkout (full address) on the same pricing.
import { Result } from '../../../domain/shared/Result';
import { Money } from '../../../domain/shared/Money';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';
import { Address } from '../../../domain/identity/value-objects/Address.vo';
import { ICartRepository } from '../../../domain/commerce/repositories/ICartRepository';
import { IOrderRequestRepository } from '../../../domain/commerce/repositories/IOrderRequestRepository';
import { IPricingCalculator } from '../../../domain/commerce/services/IPricingCalculator';
import { OrderRequest } from '../../../domain/commerce/entities/OrderRequest';
import { OrderRequestLine } from '../../../domain/commerce/entities/OrderRequestLine';
import { IdempotencyKey } from '../../../domain/commerce/value-objects/IdempotencyKey';
import { PaymentIntent } from '../../../domain/commerce/value-objects/PaymentIntent';
import { RestaurantSnapshot } from '../../../domain/commerce/value-objects/snapshots/RestaurantSnapshot';
import { MenuItemSnapshot } from '../../../domain/commerce/value-objects/snapshots/MenuItemSnapshot';
import { VariantSnapshot } from '../../../domain/commerce/value-objects/snapshots/VariantSnapshot';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IOutboxStore } from '../../shared/outbox/IOutboxStore';
import { IEventBus } from '../../shared/events/IEventBus';
import { CheckoutContextAssembler, CheckoutAssembly, ResolvedCheckoutLine } from '../services/CheckoutContextAssembler';
import { CheckoutRequestDto } from '../dtos/CheckoutRequestDto';
import { OrderRequestSummaryResponse, toOrderRequestSummaryResponse } from '../responses/OrderRequestSummaryResponse';
import { CommerceTelemetry } from '../observability/CommerceTelemetry';
import { ISpan } from '../../shared/observability/ITelemetry';
import { DomainError } from '../../../domain/shared/errors/DomainError';

export class Checkout {
  constructor(
    private readonly cartRepo: ICartRepository,
    private readonly orderRequestRepo: IOrderRequestRepository,
    private readonly assembler: CheckoutContextAssembler,
    private readonly pricingCalculator: IPricingCalculator,
    private readonly unitOfWork: IUnitOfWork,
    private readonly outboxStore: IOutboxStore,
    private readonly eventBus: IEventBus,
    private readonly telemetry: CommerceTelemetry = new CommerceTelemetry()
  ) {}

  async execute(dto: CheckoutRequestDto): Promise<Result<OrderRequestSummaryResponse>> {
    // Phase 14: span the whole committing flow (load→ACL→price→persist→publish, §11). `fail` records the
    // failure metric + reason and closes the span at every early-return; `succeed` does the success path.
    const span = this.telemetry.startCheckoutSpan({ customerId: dto.customerId });
    const fail = (error: string | DomainError, span: ISpan): Result<OrderRequestSummaryResponse> => {
      const reason = error instanceof DomainError ? error.code : 'CHECKOUT_ERROR';
      this.telemetry.checkoutFailed(reason, { customerId: dto.customerId });
      span.fail(error, { reason });
      return Result.fail<OrderRequestSummaryResponse>(error);
    };

    // Step 0 — idempotency. A supplied key is validated to its canonical shape; an absent one is minted.
    const keyResult = dto.idempotencyKey
      ? IdempotencyKey.create(dto.idempotencyKey)
      : Result.ok<IdempotencyKey>(IdempotencyKey.generate());
    if (keyResult.isFailure) return fail(keyResult.getError(), span);
    const idempotencyKey = keyResult.getValue();

    // Replay: a previously-committed key returns the original OrderRequest unchanged (no persist/publish).
    const existing = await this.orderRequestRepo.findByIdempotencyKey(idempotencyKey.value);
    if (existing) {
      this.telemetry.checkoutReplayed({
        customerId: dto.customerId,
        orderRequestId: existing.id.toString(),
        idempotencyKey: idempotencyKey.value,
      });
      span.end({ replayed: true });
      return Result.ok<OrderRequestSummaryResponse>(toOrderRequestSummaryResponse(existing));
    }

    const paymentIntentResult = PaymentIntent.create({ method: dto.paymentMethod });
    if (paymentIntentResult.isFailure) return fail(paymentIntentResult.getError(), span);

    const coords = dto.deliveryAddress.coordinates;
    const pointResult = GeoPoint.create(coords.lat, coords.lng);
    if (pointResult.isFailure) return fail(pointResult.getError(), span);

    const addressResult = Address.create({
      label: dto.deliveryAddress.label,
      street: dto.deliveryAddress.street,
      city: dto.deliveryAddress.city,
      state: dto.deliveryAddress.state,
      pinCode: dto.deliveryAddress.pinCode,
      coordinates: pointResult.getValue(),
    });
    if (addressResult.isFailure) return fail(addressResult.getError(), span);

    const cart = await this.cartRepo.findByCustomerId(dto.customerId);
    if (!cart) return fail(new NotFoundError('cart_not_found'), span);

    // Steps 1-7 — shared authoritative read + recompute (restaurant/items/serviceability/promotion).
    const assemblyResult = await this.assembler.assemble(cart, pointResult.getValue());
    if (assemblyResult.isFailure) return fail(assemblyResult.getError(), span);
    const assembly = assemblyResult.getValue();

    const pricingStartedAt = Date.now();
    const breakdownResult = this.pricingCalculator.calculate(assembly.pricingContext);
    this.telemetry.recordPricingLatency(Date.now() - pricingStartedAt, { mode: 'checkout' });
    if (breakdownResult.isFailure) return fail(breakdownResult.getError(), span);

    // Turn the recomputed context into immutable snapshots + lines.
    const restaurantResult = this.buildRestaurantSnapshot(assembly);
    if (restaurantResult.isFailure) return fail(restaurantResult.getError(), span);

    const linesResult = this.buildLines(assembly.resolvedLines);
    if (linesResult.isFailure) return fail(linesResult.getError(), span);

    const orderResult = OrderRequest.createFromCheckout({
      customerId: dto.customerId,
      idempotencyKey,
      restaurant: restaurantResult.getValue(),
      lines: linesResult.getValue(),
      pricing: breakdownResult.getValue(),
      deliveryAddress: addressResult.getValue(),
      paymentIntent: paymentIntentResult.getValue(),
    });
    if (orderResult.isFailure) return fail(orderResult.getError(), span);
    const order = orderResult.getValue();

    const orderEvents = order.pullDomainEvents();

    // Empty the cart in the same transaction so a confirmed checkout cannot be re-priced from a stale cart.
    const clearResult = cart.clear();
    if (clearResult.isFailure) return fail(clearResult.getError(), span);
    const cartEvents = cart.pullDomainEvents();

    // Atomic commit: the OrderRequest, its outbox rows, and the cleared cart all persist together.
    await this.unitOfWork.runInTransaction(async (ctx) => {
      await this.orderRequestRepo.save(order);
      await this.outboxStore.append(orderEvents, ctx);
      await this.cartRepo.save(cart);
    });

    // Post-commit publish: outbox-routed order events (also onto the in-process bus) + the in-process cart event.
    await this.eventBus.publishAll([...orderEvents, ...cartEvents]);

    // Audit + success metric: the OrderRequest is the immutable audit artifact (§11); emit a correlatable trail.
    const orderRequestId = order.id.toString();
    this.telemetry.orderRequestCreated({
      orderRequestId,
      customerId: dto.customerId,
      restaurantId: order.restaurant.restaurantId,
      total: order.pricing.total.amount,
      currency: order.pricing.total.currency,
      paymentMethod: dto.paymentMethod,
      idempotencyKey: idempotencyKey.value,
      schemaVersion: order.schemaVersion,
    });
    this.telemetry.checkoutSucceeded({ orderRequestId, customerId: dto.customerId });
    span.end({ ok: true, orderRequestId });

    return Result.ok<OrderRequestSummaryResponse>(toOrderRequestSummaryResponse(order));
  }

  private buildRestaurantSnapshot(assembly: CheckoutAssembly): Result<RestaurantSnapshot> {
    // The assembler models the ACL's resolved delivery fee as a single covering tier on the PricingContext;
    // the snapshot preserves the same tier so the pricing pipeline can be re-run from the persisted order.
    return RestaurantSnapshot.create({
      restaurantId: assembly.restaurant.restaurantId,
      name: assembly.restaurant.name,
      status: assembly.restaurant.status,
      openAtCheckout: assembly.restaurant.isOpen,
      deliveryFeeInputs: {
        feeTiers: assembly.pricingContext.deliveryInputs.feeTiers.map((tier) => ({
          maxDistanceMeters: tier.maxDistanceMeters,
          fee: tier.fee,
        })),
        freeAboveSubtotal: assembly.pricingContext.deliveryInputs.freeAboveSubtotal,
      },
    });
  }

  private buildLines(resolvedLines: ResolvedCheckoutLine[]): Result<OrderRequestLine[]> {
    const lines: OrderRequestLine[] = [];
    for (const resolved of resolvedLines) {
      const menuItemResult = MenuItemSnapshot.create({
        menuItemId: resolved.menuItemId,
        name: resolved.name,
        basePrice: resolved.basePrice,
        categoryId: resolved.categoryId,
      });
      if (menuItemResult.isFailure) return Result.fail<OrderRequestLine[]>(menuItemResult.getError());

      const options: VariantSnapshot[] = [];
      let unitPrice = resolved.basePrice;
      for (const option of resolved.selectedOptions) {
        const variantResult = VariantSnapshot.create({
          optionId: option.optionId,
          label: option.label,
          priceDelta: option.priceDelta,
        });
        if (variantResult.isFailure) return Result.fail<OrderRequestLine[]>(variantResult.getError());
        options.push(variantResult.getValue());

        const addResult = unitPrice.add(option.priceDelta);
        if (addResult.isFailure) return Result.fail<OrderRequestLine[]>(addResult.getError());
        unitPrice = addResult.getValue();
      }

      const lineTotal: Money = unitPrice.multiply(resolved.quantity.value);

      const lineResult = OrderRequestLine.create({
        menuItem: menuItemResult.getValue(),
        selectedOptions: options,
        quantity: resolved.quantity,
        lineTotal,
      });
      if (lineResult.isFailure) return Result.fail<OrderRequestLine[]>(lineResult.getError());
      lines.push(lineResult.getValue());
    }

    return Result.ok<OrderRequestLine[]>(lines);
  }
}
