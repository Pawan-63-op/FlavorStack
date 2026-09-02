import type { Connection } from 'mongoose';
import { IFulfillmentRepository } from '../domain/fulfillment/repositories/IFulfillmentRepository';
import { IDeliveryAssignmentService } from '../domain/fulfillment/services/IDeliveryAssignmentService';
import { ICustomerTrackingRepository } from '../domain/fulfillment/repositories/ICustomerTrackingRepository';
import { IFulfillmentQueryRepository } from '../domain/fulfillment/repositories/IFulfillmentQueryRepository';
import {
  IFulfillmentReadCache,
  IFulfillmentCacheInvalidator,
} from '../domain/fulfillment/services/IFulfillmentCache';
import { MongoFulfillmentRepository } from '../infrastructure/repositories/FulfillmentRepository';
import { MongoCustomerTrackingRepository } from '../infrastructure/repositories/CustomerTrackingRepository';
import { MongoFulfillmentQueryRepository } from '../infrastructure/repositories/FulfillmentQueryRepository';
import {
  SimpleDeliveryAssignmentService,
  AvailableRidersProvider,
} from '../infrastructure/services/SimpleDeliveryAssignmentService';
import { IRestaurantDirectory } from '../application/fulfillment/ports/IRestaurantDirectory';
import { MongoUnitOfWork } from '../infrastructure/database/MongoUnitOfWork';
import { TransactionContext } from '../infrastructure/database/TransactionContext';
import { getFulfillmentConfig } from '../config/fulfillment';
import { IUnitOfWork } from '../application/shared/ports/IUnitOfWork';
import { IEventBus } from '../application/shared/events/IEventBus';
import { CreateFulfillment } from '../application/fulfillment/use-cases/CreateFulfillment';
import { MarkPreparing } from '../application/fulfillment/use-cases/MarkPreparing';
import { MarkReadyForPickup } from '../application/fulfillment/use-cases/MarkReadyForPickup';
import { GetRestaurantFulfillments } from '../application/fulfillment/use-cases/GetRestaurantFulfillments';
import { GetLiveTracking } from '../application/fulfillment/use-cases/GetLiveTracking';
import { ListCustomerOrders } from '../application/fulfillment/use-cases/ListCustomerOrders';
import { GetRiderQueue } from '../application/fulfillment/use-cases/GetRiderQueue';
import { GetRiderDeliveryHistory } from '../application/fulfillment/use-cases/GetRiderDeliveryHistory';
import { GetAdminDashboard } from '../application/fulfillment/use-cases/GetAdminDashboard';
import { GetDashboardAnalytics } from '../application/fulfillment/use-cases/GetDashboardAnalytics';
import { OfferRiderAssignment } from '../application/fulfillment/use-cases/OfferRiderAssignment';
import { AssignRider } from '../application/fulfillment/use-cases/AssignRider';
import { AcceptDelivery } from '../application/fulfillment/use-cases/AcceptDelivery';
import { RejectDelivery } from '../application/fulfillment/use-cases/RejectDelivery';
import { ConfirmPickup } from '../application/fulfillment/use-cases/ConfirmPickup';
import { StartDelivery } from '../application/fulfillment/use-cases/StartDelivery';
import { CompleteDelivery } from '../application/fulfillment/use-cases/CompleteDelivery';
import { CancelFulfillment } from '../application/fulfillment/use-cases/CancelFulfillment';
import { FailDelivery } from '../application/fulfillment/use-cases/FailDelivery';
import { ReassignRider } from '../application/fulfillment/use-cases/ReassignRider';
import { HandleAssignmentTimeout } from '../application/fulfillment/use-cases/HandleAssignmentTimeout';
import { HandleSlaTimeout } from '../application/fulfillment/use-cases/HandleSlaTimeout';
import { FulfillmentJobHandler } from '../application/fulfillment/jobs/FulfillmentJobHandler';
import { IFulfillmentJobScheduler } from '../application/fulfillment/jobs/FulfillmentJob';
import { OnOrderRequested } from '../application/fulfillment/event-handlers/OnOrderRequested';
import { OnReadyForPickup } from '../application/fulfillment/event-handlers/OnReadyForPickup';
import { FulfillmentTimeoutScheduler } from '../application/fulfillment/event-handlers/FulfillmentTimeoutScheduler';
import { FulfillmentProjector } from '../application/fulfillment/projector/FulfillmentProjector';
import { registerFulfillmentEventHandlers } from '../application/fulfillment/event-handlers/FulfillmentEventRegistry';
import { RecordRiderLocation } from '../application/fulfillment/use-cases/RecordRiderLocation';
import { TrackingStatusBridge } from '../application/fulfillment/event-handlers/TrackingStatusBridge';
import { ILiveLocationStore } from '../application/fulfillment/ports/ILiveLocationStore';
import { IDeliveryTrackingStore } from '../application/fulfillment/ports/IDeliveryTrackingStore';
import { ITrackingBroadcaster } from '../application/fulfillment/ports/ITrackingBroadcaster';
import { getRealtimeConfig } from '../config/realtime';

/**
 * Realtime infrastructure ports (Phase 7). Constructed in `container/index.ts` (needs Redis) and
 * passed in; absent in unit/integration harnesses that don't exercise realtime.
 */
export interface FulfillmentRealtimeDeps {
  liveLocationStore: ILiveLocationStore;
  deliveryTrackingStore: IDeliveryTrackingStore;
  broadcaster: ITrackingBroadcaster;
}

export interface FulfillmentContainer {
  fulfillmentRepository: IFulfillmentRepository;
  trackingRepository: ICustomerTrackingRepository;
  queryRepository: IFulfillmentQueryRepository;
  assignmentService: IDeliveryAssignmentService;
  unitOfWork: IUnitOfWork;
  txContext: TransactionContext;
  createFulfillment: CreateFulfillment;
  markPreparing: MarkPreparing;
  markReadyForPickup: MarkReadyForPickup;
  getRestaurantFulfillments: GetRestaurantFulfillments;
  getLiveTracking: GetLiveTracking;
  listCustomerOrders: ListCustomerOrders;
  getRiderQueue: GetRiderQueue;
  getRiderDeliveryHistory: GetRiderDeliveryHistory;
  getAdminDashboard: GetAdminDashboard;
  getDashboardAnalytics: GetDashboardAnalytics;
  offerRiderAssignment: OfferRiderAssignment;
  assignRider: AssignRider;
  acceptDelivery: AcceptDelivery;
  rejectDelivery: RejectDelivery;
  confirmPickup: ConfirmPickup;
  startDelivery: StartDelivery;
  completeDelivery: CompleteDelivery;
  cancelFulfillment: CancelFulfillment;
  failDelivery: FailDelivery;
  reassignRider: ReassignRider;
  handleAssignmentTimeout: HandleAssignmentTimeout;
  handleSlaTimeout: HandleSlaTimeout;
  fulfillmentJobHandler: FulfillmentJobHandler;
  onOrderRequested: OnOrderRequested;
  onReadyForPickup: OnReadyForPickup;
  projector: FulfillmentProjector;
  recordRiderLocation?: RecordRiderLocation;
  trackingStatusBridge?: TrackingStatusBridge;
}

/**
 * Read-side cache (Phase 9 / Batch 9.1). Supplied only by the process that has Redis (the API
 * process via container/index.ts); absent in unit/integration harnesses, where the query use cases
 * and projector fall back to direct projection reads with no invalidation.
 */
export type FulfillmentReadCacheDeps = IFulfillmentReadCache & IFulfillmentCacheInvalidator;

export function createFulfillmentContainer(
  connection: Connection,
  eventBus: IEventBus,
  jobScheduler?: IFulfillmentJobScheduler,
  realtime?: FulfillmentRealtimeDeps,
  cache?: FulfillmentReadCacheDeps,
  restaurantDirectory: IRestaurantDirectory = {
    getOwnerId: async () => null,
    listRestaurantIdsByOwner: async () => [],
    getRestaurantNames: async () => ({}),
    countAll: async () => 0,
  },
  availableRidersProvider: AvailableRidersProvider = async () => []
): FulfillmentContainer {
  const txContext = new TransactionContext();
  const fulfillmentRepository = new MongoFulfillmentRepository(txContext);
  const trackingRepository = new MongoCustomerTrackingRepository();
  const queryRepository = new MongoFulfillmentQueryRepository();
  const unitOfWork = new MongoUnitOfWork(connection, txContext);
  const { offerTtlSeconds, maxAssignmentAttempts, readyForPickupSlaSeconds, outForDeliverySlaSeconds } =
    getFulfillmentConfig();

  const assignmentService: IDeliveryAssignmentService = new SimpleDeliveryAssignmentService(
    availableRidersProvider
  );

  const createFulfillment = new CreateFulfillment(fulfillmentRepository, unitOfWork, eventBus);
  const markPreparing = new MarkPreparing(fulfillmentRepository, restaurantDirectory, unitOfWork, eventBus);
  const markReadyForPickup = new MarkReadyForPickup(fulfillmentRepository, restaurantDirectory, unitOfWork, eventBus);
  const getRestaurantFulfillments = new GetRestaurantFulfillments(fulfillmentRepository);

  const getLiveTracking = new GetLiveTracking(trackingRepository, cache);
  const listCustomerOrders = new ListCustomerOrders(trackingRepository);
  const getRiderQueue = new GetRiderQueue(queryRepository);
  const getRiderDeliveryHistory = new GetRiderDeliveryHistory(queryRepository);
  const getAdminDashboard = new GetAdminDashboard(queryRepository, cache);
  const getDashboardAnalytics = new GetDashboardAnalytics(queryRepository, restaurantDirectory);

  const offerRiderAssignment = new OfferRiderAssignment(
    fulfillmentRepository,
    assignmentService,
    unitOfWork,
    eventBus,
    offerTtlSeconds
  );
  const assignRider = new AssignRider(
    fulfillmentRepository,
    assignmentService,
    unitOfWork,
    eventBus,
    offerTtlSeconds
  );
  const acceptDelivery = new AcceptDelivery(fulfillmentRepository, unitOfWork, eventBus);
  const rejectDelivery = new RejectDelivery(
    fulfillmentRepository,
    unitOfWork,
    eventBus,
    offerRiderAssignment
  );
  const confirmPickup = new ConfirmPickup(fulfillmentRepository, unitOfWork, eventBus);
  const startDelivery = new StartDelivery(fulfillmentRepository, unitOfWork, eventBus);
  const completeDelivery = new CompleteDelivery(fulfillmentRepository, unitOfWork, eventBus);
  const cancelFulfillment = new CancelFulfillment(fulfillmentRepository, unitOfWork, eventBus);
  const failDelivery = new FailDelivery(fulfillmentRepository, unitOfWork, eventBus);
  const reassignRider = new ReassignRider(
    fulfillmentRepository,
    assignmentService,
    unitOfWork,
    eventBus,
    offerTtlSeconds,
    assignRider
  );

  const handleAssignmentTimeout = new HandleAssignmentTimeout(
    fulfillmentRepository,
    unitOfWork,
    eventBus,
    offerRiderAssignment,
    cancelFulfillment,
    maxAssignmentAttempts
  );
  const handleSlaTimeout = new HandleSlaTimeout(fulfillmentRepository, cancelFulfillment);
  const fulfillmentJobHandler = new FulfillmentJobHandler(handleAssignmentTimeout, handleSlaTimeout);

  const onOrderRequested = new OnOrderRequested(createFulfillment);
  const onReadyForPickup = new OnReadyForPickup(offerRiderAssignment);

  const timeoutScheduler = jobScheduler
    ? new FulfillmentTimeoutScheduler(jobScheduler, readyForPickupSlaSeconds, outForDeliverySlaSeconds)
    : undefined;

  const projector = new FulfillmentProjector(trackingRepository, cache);

  let recordRiderLocation: RecordRiderLocation | undefined;
  let trackingStatusBridge: TrackingStatusBridge | undefined;
  if (realtime) {
    const { trackingPersistThrottleSeconds } = getRealtimeConfig();
    recordRiderLocation = new RecordRiderLocation(
      fulfillmentRepository,
      realtime.liveLocationStore,
      realtime.deliveryTrackingStore,
      realtime.broadcaster,
      trackingPersistThrottleSeconds
    );
    trackingStatusBridge = new TrackingStatusBridge(realtime.broadcaster);
  }

  registerFulfillmentEventHandlers(
    eventBus,
    onReadyForPickup,
    timeoutScheduler,
    projector,
    trackingStatusBridge
  );

  return {
    fulfillmentRepository,
    trackingRepository,
    queryRepository,
    assignmentService,
    unitOfWork,
    txContext,
    createFulfillment,
    markPreparing,
    markReadyForPickup,
    getRestaurantFulfillments,
    getLiveTracking,
    listCustomerOrders,
    getRiderQueue,
    getRiderDeliveryHistory,
    getAdminDashboard,
    getDashboardAnalytics,
    offerRiderAssignment,
    assignRider,
    acceptDelivery,
    rejectDelivery,
    confirmPickup,
    startDelivery,
    completeDelivery,
    cancelFulfillment,
    failDelivery,
    reassignRider,
    handleAssignmentTimeout,
    handleSlaTimeout,
    fulfillmentJobHandler,
    onOrderRequested,
    onReadyForPickup,
    projector,
    recordRiderLocation,
    trackingStatusBridge,
  };
}
