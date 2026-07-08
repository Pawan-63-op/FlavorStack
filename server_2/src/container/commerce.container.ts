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
  const telemetry = new CommerceTelemetry(new PinoTelemetry());

  const txContext = new TransactionContext();
  const cartRepository = new MongoCartRepository(txContext);
  const orderRequestRepository = new MongoOrderRequestRepository(txContext);
  const unitOfWork = new MongoUnitOfWork(connection, txContext);
  const outboxStore = new MongoOutboxStore(txContext);

  const catalogTxContext = new TransactionContext();
  const restaurantRepo = new MongoRestaurantRepository(catalogTxContext);
  const menuItemRepo = new MongoMenuItemRepository(catalogTxContext);
  const catalogReadRepository = new CommerceCatalogReadRepository();
  const catalogProjector = new CommerceCatalogProjector(restaurantRepo, menuItemRepo, catalogReadRepository, telemetry);
  registerCommerceCatalogProjector(eventBus, catalogProjector);

  const cartValidator = new CartValidator();

  const promotionService = new PromotionService(buildDefaultCommerceCoupons());

  const catalogGateway = new CatalogGateway(
    catalogGatewayDeps.readRepository,
    catalogGatewayDeps.serviceabilityQuery,
    catalogGatewayDeps.openingHoursService
  );

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
