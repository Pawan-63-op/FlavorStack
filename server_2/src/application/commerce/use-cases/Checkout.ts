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
    const span = this.telemetry.startCheckoutSpan({ customerId: dto.customerId });
    const fail = (error: string | DomainError, span: ISpan): Result<OrderRequestSummaryResponse> => {
      const reason = error instanceof DomainError ? error.code : 'CHECKOUT_ERROR';
      this.telemetry.checkoutFailed(reason, { customerId: dto.customerId });
      span.fail(error, { reason });
      return Result.fail<OrderRequestSummaryResponse>(error);
    };

    const keyResult = dto.idempotencyKey
      ? IdempotencyKey.create(dto.idempotencyKey)
      : Result.ok<IdempotencyKey>(IdempotencyKey.generate());
    if (keyResult.isFailure) return fail(keyResult.getError(), span);
    const idempotencyKey = keyResult.getValue();

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

    const assemblyResult = await this.assembler.assemble(cart, pointResult.getValue());
    if (assemblyResult.isFailure) return fail(assemblyResult.getError(), span);
    const assembly = assemblyResult.getValue();

    const pricingStartedAt = Date.now();
    const breakdownResult = this.pricingCalculator.calculate(assembly.pricingContext);
    this.telemetry.recordPricingLatency(Date.now() - pricingStartedAt, { mode: 'checkout' });
    if (breakdownResult.isFailure) return fail(breakdownResult.getError(), span);

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

    const clearResult = cart.clear();
    if (clearResult.isFailure) return fail(clearResult.getError(), span);
    const cartEvents = cart.pullDomainEvents();

    await this.unitOfWork.runInTransaction(async (ctx) => {
      await this.orderRequestRepo.save(order);
      await this.outboxStore.append(orderEvents, ctx);
      await this.cartRepo.save(cart);
    });

    await this.eventBus.publishAll([...orderEvents, ...cartEvents]);

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
