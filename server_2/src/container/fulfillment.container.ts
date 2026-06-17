// Composition root for the Fulfillment bounded context (fulfillment_module.md).
//
// Phase 1: CreateFulfillment + OnOrderRequested handler.
// Phase 2: MarkPreparing, MarkReadyForPickup, GetRestaurantFulfillments.
// Phase 3B: OfferRiderAssignment, AssignRider, AcceptDelivery, RejectDelivery + auto-offer on
//           ReadyForPickup (OnReadyForPickup) + IDeliveryAssignmentService.
// Phase 5A: CancelFulfillment.
// Phase 5B: FailDelivery, ReassignRider + BullMQ timeout/SLA jobs.
// Phase 6: Read-model projections (FulfillmentProjector) + query use cases.
// Phase 7: Realtime tracking — RecordRiderLocation + TrackingStatusBridge (wired only when the
//          realtime deps bundle is supplied, i.e. the API process; see container/index.ts).
import type { Connection } from 'mongoose';
import { IFulfillmentRepository } from '../domain/fulfillment/repositories/IFulfillmentRepository';
import { IDeliveryAssignmentService } from '../domain/fulfillment/services/IDeliveryAssignmentService';
import { IFulfillmentProjectionRepository } from '../domain/fulfillment/repositories/IFulfillmentProjectionRepository';
import {
  IFulfillmentReadCache,
  IFulfillmentCacheInvalidator,
} from '../domain/fulfillment/services/IFulfillmentCache';
import { MongoFulfillmentRepository } from '../infrastructure/repositories/FulfillmentRepository';
import { MongoFulfillmentProjectionRepository } from '../infrastructure/repositories/FulfillmentProjectionRepository';
import { SimpleDeliveryAssignmentService } from '../infrastructure/services/SimpleDeliveryAssignmentService';
import { MongoUnitOfWork } from '../infrastructure/database/MongoUnitOfWork';
import { MongoOutboxStore } from '../infrastructure/database/MongoOutboxStore';
import { TransactionContext } from '../infrastructure/database/TransactionContext';
import { getFulfillmentConfig } from '../config/fulfillment';
import { IUnitOfWork } from '../application/shared/ports/IUnitOfWork';
import { IOutboxStore } from '../application/shared/outbox/IOutboxStore';
import { IEventBus } from '../application/shared/events/IEventBus';
import { CreateFulfillment } from '../application/fulfillment/use-cases/CreateFulfillment';
import { MarkPreparing } from '../application/fulfillment/use-cases/MarkPreparing';
import { MarkReadyForPickup } from '../application/fulfillment/use-cases/MarkReadyForPickup';
import { GetRestaurantFulfillments } from '../application/fulfillment/use-cases/GetRestaurantFulfillments';
import { GetFulfillment } from '../application/fulfillment/use-cases/GetFulfillment';
import { GetLiveTracking } from '../application/fulfillment/use-cases/GetLiveTracking';
import { GetRiderQueue } from '../application/fulfillment/use-cases/GetRiderQueue';
import { GetAdminDashboard } from '../application/fulfillment/use-cases/GetAdminDashboard';
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
import { FulfillmentNotificationDispatcher } from '../application/fulfillment/event-handlers/FulfillmentNotificationDispatcher';
import { INotificationQueue } from '../application/shared/queues/INotificationQueue';
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
  projectionRepository: IFulfillmentProjectionRepository;
  assignmentService: IDeliveryAssignmentService;
  unitOfWork: IUnitOfWork;
  outboxStore: IOutboxStore;
  txContext: TransactionContext;
  createFulfillment: CreateFulfillment;
  markPreparing: MarkPreparing;
  markReadyForPickup: MarkReadyForPickup;
  getRestaurantFulfillments: GetRestaurantFulfillments;
  getFulfillment: GetFulfillment;
  getLiveTracking: GetLiveTracking;
  getRiderQueue: GetRiderQueue;
  getAdminDashboard: GetAdminDashboard;
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
  // Phase 7 — present only when realtime deps were supplied.
  recordRiderLocation?: RecordRiderLocation;
  trackingStatusBridge?: TrackingStatusBridge;
  // Phase 8 — present only when an INotificationQueue was supplied.
  notificationDispatcher?: FulfillmentNotificationDispatcher;
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
  notificationQueue?: INotificationQueue,
  cache?: FulfillmentReadCacheDeps
): FulfillmentContainer {
  const txContext = new TransactionContext();
  const fulfillmentRepository = new MongoFulfillmentRepository(txContext);
  const projectionRepository = new MongoFulfillmentProjectionRepository();
  const unitOfWork = new MongoUnitOfWork(connection, txContext);
  const outboxStore = new MongoOutboxStore(txContext);
  const { offerTtlSeconds, maxAssignmentAttempts, readyForPickupSlaSeconds, outForDeliverySlaSeconds } =
    getFulfillmentConfig();

  const assignmentService: IDeliveryAssignmentService = new SimpleDeliveryAssignmentService(async () => []);

  const createFulfillment = new CreateFulfillment(fulfillmentRepository, unitOfWork, outboxStore, eventBus);
  const markPreparing = new MarkPreparing(fulfillmentRepository, unitOfWork, outboxStore, eventBus);
  const markReadyForPickup = new MarkReadyForPickup(fulfillmentRepository, unitOfWork, outboxStore, eventBus);
  const getRestaurantFulfillments = new GetRestaurantFulfillments(fulfillmentRepository);

  // Phase 6 query use cases (read from projections).
  const getFulfillment = new GetFulfillment(projectionRepository);
  const getLiveTracking = new GetLiveTracking(projectionRepository, cache);
  const getRiderQueue = new GetRiderQueue(projectionRepository);
  const getAdminDashboard = new GetAdminDashboard(projectionRepository, cache);

  const offerRiderAssignment = new OfferRiderAssignment(
    fulfillmentRepository,
    assignmentService,
    unitOfWork,
    outboxStore,
    eventBus,
    offerTtlSeconds
  );
  const assignRider = new AssignRider(
    fulfillmentRepository,
    assignmentService,
    unitOfWork,
    outboxStore,
    eventBus,
    offerTtlSeconds
  );
  const acceptDelivery = new AcceptDelivery(fulfillmentRepository, unitOfWork, outboxStore, eventBus);
  const rejectDelivery = new RejectDelivery(
    fulfillmentRepository,
    unitOfWork,
    outboxStore,
    eventBus,
    offerRiderAssignment
  );
  const confirmPickup = new ConfirmPickup(fulfillmentRepository, unitOfWork, outboxStore, eventBus);
  const startDelivery = new StartDelivery(fulfillmentRepository, unitOfWork, outboxStore, eventBus);
  const completeDelivery = new CompleteDelivery(fulfillmentRepository, unitOfWork, outboxStore, eventBus);
  const cancelFulfillment = new CancelFulfillment(fulfillmentRepository, unitOfWork, outboxStore, eventBus);
  const failDelivery = new FailDelivery(fulfillmentRepository, unitOfWork, outboxStore, eventBus);
  const reassignRider = new ReassignRider(
    fulfillmentRepository,
    assignmentService,
    unitOfWork,
    outboxStore,
    eventBus,
    offerTtlSeconds,
    assignRider
  );

  const handleAssignmentTimeout = new HandleAssignmentTimeout(
    fulfillmentRepository,
    unitOfWork,
    outboxStore,
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

  // Phase 6: projector maintains read models from in-process bus events.
  // Phase 9 (Batch 9.1): also invalidates the read-side cache after each view-mutating event.
  const projector = new FulfillmentProjector(projectionRepository, cache);

  // Phase 7: realtime — only when the realtime deps bundle is supplied (API process).
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

  // Phase 8: notification dispatch — only when an INotificationQueue is supplied (the process that
  // runs the OutboxProcessor). Subscribed before that processor starts so early-drained status
  // events have a subscriber.
  const notificationDispatcher = notificationQueue
    ? new FulfillmentNotificationDispatcher(notificationQueue)
    : undefined;

  registerFulfillmentEventHandlers(
    eventBus,
    onOrderRequested,
    onReadyForPickup,
    timeoutScheduler,
    projector,
    trackingStatusBridge,
    notificationDispatcher
  );

  return {
    fulfillmentRepository,
    projectionRepository,
    assignmentService,
    unitOfWork,
    outboxStore,
    txContext,
    createFulfillment,
    markPreparing,
    markReadyForPickup,
    getRestaurantFulfillments,
    getFulfillment,
    getLiveTracking,
    getRiderQueue,
    getAdminDashboard,
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
    notificationDispatcher,
  };
}
