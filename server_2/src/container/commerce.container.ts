// Composition root for the Commerce bounded context (Phase 3 persistence + Phase 4 cart use-cases).
//
// Binds ICartRepository -> MongoCartRepository over a shared TransactionContext,
// alongside the MongoUnitOfWork + MongoOutboxStore backbone, exactly like
// CreateRestaurant / RegisterCustomer (catalog-write.container.ts, identity.container.ts).
//
// CartItemAdded / CartCleared are in-process only (not outbox-routed, per
// commerce_module.md §3.5) — AddToCart/ClearCart publish them on `eventBus`
// directly after commit; `outboxStore` is retained for future Phase 6+ commerce
// use-cases (checkout, OrderRequested) that DO need reliable delivery.
//
// Phase 5 also wires the commerce_catalog_view projector here: it subscribes to
// the same `eventBus` (which OutboxProcessor publishes every drained outbox row
// onto, including Catalog's QUEUE.commerce-routed events) and rebuilds the
// projection via Catalog's read-only domain repositories.
import type { Connection } from 'mongoose';
import { ICartRepository } from '../domain/commerce/repositories/ICartRepository';
import { IOrderRequestRepository } from '../domain/commerce/repositories/IOrderRequestRepository';
import { ICommerceCatalogReadRepository } from '../domain/commerce/repositories/ICommerceCatalogReadRepository';
import { ICartValidator } from '../domain/commerce/services/ICartValidator';
import { ICatalogGateway } from '../domain/commerce/services/ICatalogGateway';
import { ICatalogReadRepository } from '../domain/catalog/repositories/ICatalogReadRepository';
import { IOpeningHoursService } from '../domain/catalog/services/IOpeningHoursService';
import { CatalogGateway, ICatalogServiceabilityQuery } from '../infrastructure/services/CatalogGateway';
import { MongoCartRepository } from '../infrastructure/repositories/CartRepository';
import { MongoOrderRequestRepository } from '../infrastructure/repositories/OrderRequestRepository';
import { CommerceCatalogReadRepository } from '../infrastructure/repositories/CommerceCatalogReadRepository';
import { CartValidator } from '../infrastructure/services/CartValidator';
import { PromotionService } from '../infrastructure/services/PromotionService';
import { buildDefaultCommerceCoupons } from '../infrastructure/services/CommerceCouponCatalog';
import { buildDefaultCommercePricingPolicy } from '../infrastructure/services/CommercePricingConfig';
import { PricingCalculator } from '../infrastructure/services/PricingCalculator';
import { IPromotionService } from '../domain/commerce/services/IPromotionService';
import { IPricingCalculator } from '../domain/commerce/services/IPricingCalculator';
import { CheckoutContextAssembler } from '../application/commerce/services/CheckoutContextAssembler';
import { MongoRestaurantRepository } from '../infrastructure/repositories/RestaurantRepository';
import { MongoMenuItemRepository } from '../infrastructure/repositories/MenuItemRepository';
import { MongoUnitOfWork } from '../infrastructure/database/MongoUnitOfWork';
import { MongoOutboxStore } from '../infrastructure/database/MongoOutboxStore';
import { TransactionContext } from '../infrastructure/database/TransactionContext';
import { IUnitOfWork } from '../application/shared/ports/IUnitOfWork';
import { IOutboxStore } from '../application/shared/outbox/IOutboxStore';
import { IEventBus } from '../application/shared/events/IEventBus';

import { CreateCart } from '../application/commerce/use-cases/CreateCart';
import { GetCart } from '../application/commerce/use-cases/GetCart';
import { GetCartSummary } from '../application/commerce/use-cases/GetCartSummary';
import { AddToCart } from '../application/commerce/use-cases/AddToCart';
import { RemoveFromCart } from '../application/commerce/use-cases/RemoveFromCart';
import { UpdateCartItem } from '../application/commerce/use-cases/UpdateCartItem';
import { ClearCart } from '../application/commerce/use-cases/ClearCart';
import { ApplyPromotion } from '../application/commerce/use-cases/ApplyPromotion';
import { RemovePromotion } from '../application/commerce/use-cases/RemovePromotion';
import { ValidatePromotion } from '../application/commerce/use-cases/ValidatePromotion';
import { PreviewCheckout } from '../application/commerce/use-cases/PreviewCheckout';
import { Checkout } from '../application/commerce/use-cases/Checkout';
import { GetOrderRequest } from '../application/commerce/use-cases/GetOrderRequest';
import { CommerceCatalogProjector } from '../application/commerce/handlers/CommerceCatalogProjector';
import { registerCommerceCatalogProjector } from '../application/commerce/handlers/CommerceProjectionRegistry';
import { CommerceTelemetry } from '../application/commerce/observability/CommerceTelemetry';
import { PinoTelemetry } from '../infrastructure/observability/PinoTelemetry';

export interface CommerceCommandUseCases {
  createCart: CreateCart;
  getCart: GetCart;
  getCartSummary: GetCartSummary;
  addToCart: AddToCart;
  removeFromCart: RemoveFromCart;
  updateCartItem: UpdateCartItem;
  clearCart: ClearCart;
  applyPromotion: ApplyPromotion;
  removePromotion: RemovePromotion;
  validatePromotion: ValidatePromotion;
  previewCheckout: PreviewCheckout;
  checkout: Checkout;
  getOrderRequest: GetOrderRequest;
}

export interface CommerceContainer {
  cartRepository: ICartRepository;
  orderRequestRepository: IOrderRequestRepository;
  unitOfWork: IUnitOfWork;
  outboxStore: IOutboxStore;
  txContext: TransactionContext;
  catalogReadRepository: ICommerceCatalogReadRepository;
  catalogProjector: CommerceCatalogProjector;
  cartValidator: ICartValidator;
  promotionService: IPromotionService;
  catalogGateway: ICatalogGateway;
  pricingCalculator: IPricingCalculator;
  checkoutAssembler: CheckoutContextAssembler;
  telemetry: CommerceTelemetry;
  commands: CommerceCommandUseCases;
}

// Phase 10 ACL deps — Catalog's three published read ports, supplied from the Catalog read
// container (see container/index.ts). Commerce never instantiates Catalog read concretes itself;
// it adapts what Catalog publishes, keeping the future service split a network-call swap.
export interface CommerceCatalogGatewayDeps {
  readRepository: ICatalogReadRepository;
  serviceabilityQuery: ICatalogServiceabilityQuery;
  openingHoursService: IOpeningHoursService;
}

export function createCommerceContainer(
  connection: Connection,
  eventBus: IEventBus,
  catalogGatewayDeps: CommerceCatalogGatewayDeps
): CommerceContainer {
  // Phase 14: observability façade — structured logging + metrics + tracing for Commerce workflows
  // (commerce_module.md §11). Composes the pino/metrics-backed PinoTelemetry; injected into the use
  // cases and the projector below. Use cases default to a NoopTelemetry when constructed without one.
  const telemetry = new CommerceTelemetry(new PinoTelemetry());

  const txContext = new TransactionContext();
  const cartRepository = new MongoCartRepository(txContext);
  const orderRequestRepository = new MongoOrderRequestRepository(txContext);
  const unitOfWork = new MongoUnitOfWork(connection, txContext);
  const outboxStore = new MongoOutboxStore(txContext);

  // Phase 5: commerce_catalog_view projection. Reads Catalog's aggregates
  // read-only via its domain repositories (over a fresh, session-less
  // TransactionContext) to rebuild the projection on catalog events
  // drained from the outbox onto `eventBus` (QUEUE.commerce).
  const catalogTxContext = new TransactionContext();
  const restaurantRepo = new MongoRestaurantRepository(catalogTxContext);
  const menuItemRepo = new MongoMenuItemRepository(catalogTxContext);
  const catalogReadRepository = new CommerceCatalogReadRepository();
  const catalogProjector = new CommerceCatalogProjector(restaurantRepo, menuItemRepo, catalogReadRepository, telemetry);
  registerCommerceCatalogProjector(eventBus, catalogProjector);

  // Phase 6: pure cart-time validator, used by GetCart against the projection above.
  const cartValidator = new CartValidator();

  // Phase 8: interim, extractable promotion engine over a hard-coded coupon catalog.
  const promotionService = new PromotionService(buildDefaultCommerceCoupons());

  // Phase 10: synchronous, query-only Catalog ACL for checkout-time authoritative reads.
  const catalogGateway = new CatalogGateway(
    catalogGatewayDeps.readRepository,
    catalogGatewayDeps.serviceabilityQuery,
    catalogGatewayDeps.openingHoursService
  );

  // Phase 11: pure pricing pipeline + the shared checkout assembly (ACL + projection + pricing policy).
  // PreviewCheckout uses both for the dry-run path; Checkout (Batch 4) reuses them for the committing path.
  const pricingCalculator = new PricingCalculator();
  const checkoutAssembler = new CheckoutContextAssembler(
    catalogGateway,
    catalogReadRepository,
    promotionService,
    buildDefaultCommercePricingPolicy()
  );

  return {
    cartRepository,
    orderRequestRepository,
    unitOfWork,
    outboxStore,
    txContext,
    catalogReadRepository,
    catalogProjector,
    cartValidator,
    promotionService,
    catalogGateway,
    pricingCalculator,
    checkoutAssembler,
    telemetry,
    commands: {
      createCart: new CreateCart(cartRepository, unitOfWork),
      getCart: new GetCart(cartRepository, catalogReadRepository, cartValidator, telemetry),
      getCartSummary: new GetCartSummary(cartRepository),
      addToCart: new AddToCart(cartRepository, unitOfWork, eventBus, telemetry),
      removeFromCart: new RemoveFromCart(cartRepository, unitOfWork),
      updateCartItem: new UpdateCartItem(cartRepository, unitOfWork),
      clearCart: new ClearCart(cartRepository, unitOfWork, eventBus),
      applyPromotion: new ApplyPromotion(cartRepository, promotionService, unitOfWork),
      removePromotion: new RemovePromotion(cartRepository, unitOfWork),
      validatePromotion: new ValidatePromotion(cartRepository, promotionService),
      previewCheckout: new PreviewCheckout(cartRepository, checkoutAssembler, pricingCalculator, telemetry),
      checkout: new Checkout(
        cartRepository,
        orderRequestRepository,
        checkoutAssembler,
        pricingCalculator,
        unitOfWork,
        outboxStore,
        eventBus,
        telemetry
      ),
      getOrderRequest: new GetOrderRequest(orderRequestRepository),
    },
  };
}
