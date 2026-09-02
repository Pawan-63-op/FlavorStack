import type { Connection } from 'mongoose';

import { TransactionContext } from '../infrastructure/database/TransactionContext';
import { MongoUnitOfWork } from '../infrastructure/database/MongoUnitOfWork';
import { IUnitOfWork } from '../application/shared/ports/IUnitOfWork';
import { IEventBus } from '../application/shared/events/IEventBus';

import { INotificationRepository } from '../domain/engagement/repositories/INotificationRepository';
import { INotificationPreferenceRepository } from '../domain/engagement/repositories/INotificationPreferenceRepository';
import { INotificationTemplateRepository } from '../domain/engagement/repositories/INotificationTemplateRepository';
import { IReviewRepository } from '../domain/engagement/repositories/IReviewRepository';
import { IFulfillmentGateway } from '../domain/engagement/services/IFulfillmentGateway';
import { IFulfillmentQueryRepository } from '../domain/fulfillment/repositories/IFulfillmentQueryRepository';

import { MongoNotificationRepository } from '../infrastructure/repositories/NotificationRepository';
import { MongoNotificationPreferenceRepository } from '../infrastructure/repositories/NotificationPreferenceRepository';
import { MongoNotificationTemplateRepository } from '../infrastructure/repositories/NotificationTemplateRepository';
import { MongoReviewRepository } from '../infrastructure/repositories/ReviewRepository';
import { FulfillmentGateway } from '../infrastructure/services/FulfillmentGateway';

import { DispatchNotification } from '../application/engagement/use-cases/DispatchNotification';
import { UpdateNotificationPreferences } from '../application/engagement/use-cases/UpdateNotificationPreferences';
import { MarkNotificationRead } from '../application/engagement/use-cases/MarkNotificationRead';
import { SubmitReview } from '../application/engagement/use-cases/SubmitReview';
import { EditReviewComment } from '../application/engagement/use-cases/EditReviewComment';
import { ModerateReview } from '../application/engagement/use-cases/ModerateReview';
import { GetNotificationPreferences } from '../application/engagement/use-cases/GetNotificationPreferences';
import { GetNotificationHistory } from '../application/engagement/use-cases/GetNotificationHistory';
import { GetUnreadCount } from '../application/engagement/use-cases/GetUnreadCount';
import { GetRestaurantReviews } from '../application/engagement/use-cases/GetRestaurantReviews';
import { GetRestaurantRating } from '../application/engagement/use-cases/GetRestaurantRating';
import { GetMyReviews } from '../application/engagement/use-cases/GetMyReviews';
import { ListPendingReviews } from '../application/engagement/use-cases/ListPendingReviews';

import { OnUserRegistered } from '../application/engagement/event-handlers/OnUserRegistered';
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
  notificationRepository: INotificationRepository;
  preferenceRepository: INotificationPreferenceRepository;
  templateRepository: INotificationTemplateRepository;
  reviewRepository: IReviewRepository;
  fulfillmentGateway: IFulfillmentGateway;
  unitOfWork: IUnitOfWork;
  txContext: TransactionContext;
  dispatchNotification: DispatchNotification;
  updateNotificationPreferences: UpdateNotificationPreferences;
  markNotificationRead: MarkNotificationRead;
  submitReview: SubmitReview;
  editReviewComment: EditReviewComment;
  moderateReview: ModerateReview;
  getNotificationPreferences: GetNotificationPreferences;
  getNotificationHistory: GetNotificationHistory;
  getUnreadCount: GetUnreadCount;
  getRestaurantReviews: GetRestaurantReviews;
  getRestaurantRating: GetRestaurantRating;
  getMyReviews: GetMyReviews;
  listPendingReviews: ListPendingReviews;
  handlers: EngagementEventHandlers;
}

/**
 * Build the Engagement graph and subscribe its event handlers onto `eventBus`. The subscription
 * happens synchronously here, before any use case can publish, so no in-process event is
 * emitted without a subscriber.
 */
export function createEngagementContainer(
  connection: Connection,
  eventBus: IEventBus,
  fulfillmentQueryRepository: IFulfillmentQueryRepository
): EngagementContainer {
  const txContext = new TransactionContext();
  const unitOfWork = new MongoUnitOfWork(connection, txContext);

  const notificationRepository = new MongoNotificationRepository(txContext);
  const preferenceRepository = new MongoNotificationPreferenceRepository(txContext);
  const templateRepository = new MongoNotificationTemplateRepository(txContext);
  const reviewRepository = new MongoReviewRepository(txContext);
  // Read-only ACL onto Fulfillment; replaces the `review_eligibility` replica.
  const fulfillmentGateway = new FulfillmentGateway(fulfillmentQueryRepository);

  const dispatchNotification = new DispatchNotification(
    notificationRepository,
    preferenceRepository,
    templateRepository,
    unitOfWork
  );

  const updateNotificationPreferences = new UpdateNotificationPreferences(preferenceRepository);
  const markNotificationRead = new MarkNotificationRead(notificationRepository);
  const submitReview = new SubmitReview(reviewRepository, fulfillmentGateway, unitOfWork, eventBus);
  const editReviewComment = new EditReviewComment(reviewRepository);
  const moderateReview = new ModerateReview(reviewRepository, unitOfWork, eventBus);

  const getNotificationPreferences = new GetNotificationPreferences(preferenceRepository);
  const getNotificationHistory = new GetNotificationHistory(notificationRepository);
  const getUnreadCount = new GetUnreadCount(notificationRepository);
  const getRestaurantReviews = new GetRestaurantReviews(reviewRepository);
  const getRestaurantRating = new GetRestaurantRating(reviewRepository);
  const getMyReviews = new GetMyReviews(reviewRepository);
  const listPendingReviews = new ListPendingReviews(reviewRepository);

  const handlers: EngagementEventHandlers = {
    onUserRegistered: new OnUserRegistered(preferenceRepository),
    onFulfillmentCreated: new OnFulfillmentCreated(dispatchNotification),
    onReadyForPickup: new OnReadyForPickup(dispatchNotification, fulfillmentGateway),
    onRiderAssigned: new OnRiderAssigned(dispatchNotification, fulfillmentGateway),
    onOutForDelivery: new OnOutForDelivery(dispatchNotification, fulfillmentGateway),
    onDeliveryCompleted: new OnDeliveryCompleted(dispatchNotification, fulfillmentGateway),
    onFulfillmentCancelled: new OnFulfillmentCancelled(dispatchNotification, fulfillmentGateway),
  };

  registerEngagementEventHandlers(eventBus, handlers);

  return {
    notificationRepository,
    preferenceRepository,
    templateRepository,
    reviewRepository,
    fulfillmentGateway,
    unitOfWork,
    txContext,
    dispatchNotification,
    updateNotificationPreferences,
    markNotificationRead,
    submitReview,
    editReviewComment,
    moderateReview,
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
