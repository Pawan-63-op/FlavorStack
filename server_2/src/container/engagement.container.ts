// Composition root for the Engagement bounded context (engagement_module.md §4 / §6 / Phase 3.B).
//
// This is the single place the Engagement object graph is assembled: the six Mongo repositories, the
// shared persistence ports (UnitOfWork + OutboxStore on a context-local TransactionContext), the
// internal DispatchNotification flow, the 13 command/query use-cases, and the nine cross-context event
// handlers. After construction it subscribes the handlers onto the in-process bus via
// registerEngagementEventHandlers.
//
// Mirrors fulfillment.container.ts: takes the Mongo Connection + shared in-process bus + the
// INotificationQueue producer (DispatchNotification enqueues onto QUEUE.notification after commit).
// Each context owns its own TransactionContext so repository session binding never crosses contexts.
//
// IMPORTANT (bootstrap ordering): the handlers are subscribed here, synchronously, as part of building
// the container. container/index.ts builds this container BEFORE the OutboxProcessor starts, so every
// drained cross-context event (UserRegistered / FulfillmentCreated / …) already has a subscriber.
import type { Connection } from 'mongoose';

import { TransactionContext } from '../infrastructure/database/TransactionContext';
import { MongoUnitOfWork } from '../infrastructure/database/MongoUnitOfWork';
import { MongoOutboxStore } from '../infrastructure/database/MongoOutboxStore';
import { IUnitOfWork } from '../application/shared/ports/IUnitOfWork';
import { IOutboxStore } from '../application/shared/outbox/IOutboxStore';
import { IEventBus } from '../application/shared/events/IEventBus';
import { INotificationQueue } from '../application/shared/queues/INotificationQueue';

import { INotificationRepository } from '../domain/engagement/repositories/INotificationRepository';
import { INotificationPreferenceRepository } from '../domain/engagement/repositories/INotificationPreferenceRepository';
import { INotificationTemplateRepository } from '../domain/engagement/repositories/INotificationTemplateRepository';
import { IReviewRepository } from '../domain/engagement/repositories/IReviewRepository';
import { IRestaurantRatingViewRepository } from '../domain/engagement/repositories/IRestaurantRatingViewRepository';
import { IReviewEligibilityRepository } from '../domain/engagement/repositories/IReviewEligibilityRepository';

import { MongoNotificationRepository } from '../infrastructure/repositories/NotificationRepository';
import { MongoNotificationPreferenceRepository } from '../infrastructure/repositories/NotificationPreferenceRepository';
import { MongoNotificationTemplateRepository } from '../infrastructure/repositories/NotificationTemplateRepository';
import { MongoReviewRepository } from '../infrastructure/repositories/ReviewRepository';
import { MongoRestaurantRatingViewRepository } from '../infrastructure/repositories/RestaurantRatingViewRepository';
import { MongoReviewEligibilityRepository } from '../infrastructure/repositories/ReviewEligibilityRepository';

import { DispatchNotification } from '../application/engagement/use-cases/DispatchNotification';
import { UpdateNotificationPreferences } from '../application/engagement/use-cases/UpdateNotificationPreferences';
import { MarkNotificationRead } from '../application/engagement/use-cases/MarkNotificationRead';
import { SubmitReview } from '../application/engagement/use-cases/SubmitReview';
import { EditReviewComment } from '../application/engagement/use-cases/EditReviewComment';
import { ModerateReview } from '../application/engagement/use-cases/ModerateReview';
import { RecomputeRestaurantRating } from '../application/engagement/use-cases/RecomputeRestaurantRating';
import { GetNotificationPreferences } from '../application/engagement/use-cases/GetNotificationPreferences';
import { GetNotificationHistory } from '../application/engagement/use-cases/GetNotificationHistory';
import { GetUnreadCount } from '../application/engagement/use-cases/GetUnreadCount';
import { GetRestaurantReviews } from '../application/engagement/use-cases/GetRestaurantReviews';
import { GetRestaurantRating } from '../application/engagement/use-cases/GetRestaurantRating';
import { GetMyReviews } from '../application/engagement/use-cases/GetMyReviews';
import { ListPendingReviews } from '../application/engagement/use-cases/ListPendingReviews';

import { OnUserRegistered } from '../application/engagement/event-handlers/OnUserRegistered';
import { OnPasswordChanged } from '../application/engagement/event-handlers/OnPasswordChanged';
import { OnPasswordResetRequested } from '../application/engagement/event-handlers/OnPasswordResetRequested';
import { OnFulfillmentCreated } from '../application/engagement/event-handlers/OnFulfillmentCreated';
import { OnReadyForPickup } from '../application/engagement/event-handlers/OnReadyForPickup';
import { OnRiderAssigned } from '../application/engagement/event-handlers/OnRiderAssigned';
import { OnOutForDelivery } from '../application/engagement/event-handlers/OnOutForDelivery';
import { OnDeliveryCompleted } from '../application/engagement/event-handlers/OnDeliveryCompleted';
import { OnFulfillmentCancelled } from '../application/engagement/event-handlers/OnFulfillmentCancelled';
import {
  EngagementEventHandlers,
  registerEngagementEventHandlers,
} from '../application/engagement/event-handlers/EngagementEventRegistry';

export interface EngagementContainer {
  // Repositories.
  notificationRepository: INotificationRepository;
  preferenceRepository: INotificationPreferenceRepository;
  templateRepository: INotificationTemplateRepository;
  reviewRepository: IReviewRepository;
  ratingViewRepository: IRestaurantRatingViewRepository;
  eligibilityRepository: IReviewEligibilityRepository;
  // Shared persistence ports.
  unitOfWork: IUnitOfWork;
  outboxStore: IOutboxStore;
  txContext: TransactionContext;
  // Use-cases (DispatchNotification is internal; the rest back the API in Phase 5).
  dispatchNotification: DispatchNotification;
  updateNotificationPreferences: UpdateNotificationPreferences;
  markNotificationRead: MarkNotificationRead;
  submitReview: SubmitReview;
  editReviewComment: EditReviewComment;
  moderateReview: ModerateReview;
  recomputeRestaurantRating: RecomputeRestaurantRating;
  getNotificationPreferences: GetNotificationPreferences;
  getNotificationHistory: GetNotificationHistory;
  getUnreadCount: GetUnreadCount;
  getRestaurantReviews: GetRestaurantReviews;
  getRestaurantRating: GetRestaurantRating;
  getMyReviews: GetMyReviews;
  listPendingReviews: ListPendingReviews;
  // Cross-context event handlers (already subscribed on the bus).
  handlers: EngagementEventHandlers;
}

/**
 * Build the Engagement graph and subscribe its event handlers onto `eventBus`. The subscription
 * happens synchronously here; callers (container/index.ts) must invoke this BEFORE starting the
 * OutboxProcessor so no committed cross-context event is drained without a subscriber.
 */
export function createEngagementContainer(
  connection: Connection,
  eventBus: IEventBus,
  notificationQueue: INotificationQueue
): EngagementContainer {
  // Context-local transaction context — bound to repos + UoW + outbox so they share one session.
  const txContext = new TransactionContext();
  const unitOfWork = new MongoUnitOfWork(connection, txContext);
  const outboxStore = new MongoOutboxStore(txContext);

  // Repositories.
  const notificationRepository = new MongoNotificationRepository(txContext);
  const preferenceRepository = new MongoNotificationPreferenceRepository(txContext);
  const templateRepository = new MongoNotificationTemplateRepository(txContext);
  const reviewRepository = new MongoReviewRepository(txContext);
  const ratingViewRepository = new MongoRestaurantRatingViewRepository(txContext);
  const eligibilityRepository = new MongoReviewEligibilityRepository(txContext);

  // Internal dispatch flow shared by every notification handler.
  const dispatchNotification = new DispatchNotification(
    notificationRepository,
    preferenceRepository,
    templateRepository,
    unitOfWork,
    outboxStore,
    eventBus,
    notificationQueue
  );

  // Command use-cases.
  const updateNotificationPreferences = new UpdateNotificationPreferences(preferenceRepository);
  const markNotificationRead = new MarkNotificationRead(notificationRepository);
  const submitReview = new SubmitReview(reviewRepository, eligibilityRepository, unitOfWork, outboxStore, eventBus);
  const editReviewComment = new EditReviewComment(reviewRepository);
  const recomputeRestaurantRating = new RecomputeRestaurantRating(reviewRepository, ratingViewRepository);
  const moderateReview = new ModerateReview(
    reviewRepository,
    unitOfWork,
    outboxStore,
    eventBus,
    recomputeRestaurantRating
  );

  // Query use-cases.
  const getNotificationPreferences = new GetNotificationPreferences(preferenceRepository);
  const getNotificationHistory = new GetNotificationHistory(notificationRepository);
  const getUnreadCount = new GetUnreadCount(notificationRepository);
  const getRestaurantReviews = new GetRestaurantReviews(reviewRepository);
  const getRestaurantRating = new GetRestaurantRating(ratingViewRepository);
  const getMyReviews = new GetMyReviews(reviewRepository);
  const listPendingReviews = new ListPendingReviews(reviewRepository);

  // Cross-context event handlers (each idempotent + best-effort; see EngagementEventRegistry).
  const handlers: EngagementEventHandlers = {
    onUserRegistered: new OnUserRegistered(dispatchNotification, preferenceRepository),
    onPasswordChanged: new OnPasswordChanged(dispatchNotification),
    onPasswordResetRequested: new OnPasswordResetRequested(dispatchNotification),
    onFulfillmentCreated: new OnFulfillmentCreated(dispatchNotification, eligibilityRepository),
    onReadyForPickup: new OnReadyForPickup(dispatchNotification, eligibilityRepository),
    onRiderAssigned: new OnRiderAssigned(dispatchNotification, eligibilityRepository),
    onOutForDelivery: new OnOutForDelivery(dispatchNotification, eligibilityRepository),
    onDeliveryCompleted: new OnDeliveryCompleted(dispatchNotification, eligibilityRepository),
    onFulfillmentCancelled: new OnFulfillmentCancelled(dispatchNotification, eligibilityRepository),
  };

  // Subscribe BEFORE the OutboxProcessor starts (enforced by build order in container/index.ts).
  registerEngagementEventHandlers(eventBus, handlers);

  return {
    notificationRepository,
    preferenceRepository,
    templateRepository,
    reviewRepository,
    ratingViewRepository,
    eligibilityRepository,
    unitOfWork,
    outboxStore,
    txContext,
    dispatchNotification,
    updateNotificationPreferences,
    markNotificationRead,
    submitReview,
    editReviewComment,
    moderateReview,
    recomputeRestaurantRating,
    getNotificationPreferences,
    getNotificationHistory,
    getUnreadCount,
    getRestaurantReviews,
    getRestaurantRating,
    getMyReviews,
    listPendingReviews,
    handlers,
  };
}
