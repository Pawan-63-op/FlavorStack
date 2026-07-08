/**
 * Public barrel for the API foundation. Import infrastructure from `@/lib/api`
 * rather than reaching into individual modules.
 */

export { client, request, rawRequest } from "./client/http";
export { createRefreshingRequest } from "./client/withRefresh";
export type { RefreshOptions, RequestFn } from "./client/withRefresh";
export { clearAuthListeners, emitAuthExpired, onAuthExpired } from "./client/authEvents";
export type { AuthExpiredListener } from "./client/authEvents";
export type { HttpMethod, RawRequestOptions, RequestOptions } from "./client/types";

export { ApiError } from "./errors/ApiError";
export type { ApiErrorCategory, ApiErrorOptions } from "./errors/ApiError";
export { normalizeError } from "./errors/normalizeError";

export { authService } from "./services/auth";
export { catalogService } from "./services/catalog";
export { catalogOwnerService } from "./services/catalogOwner";
export { cartService } from "./services/cart";
export { reviewService } from "./services/review";
export { reviewModerationService } from "./services/reviewModeration";
export { fulfillmentAdminService } from "./services/fulfillmentAdmin";
export { analyticsService } from "./services/analytics";
export { analyticsAdapter } from "./adapters/analytics";
export type {
  DashboardAnalyticsResponse,
  DashboardAnalyticsView,
} from "./adapters/analytics";
export {
  analyticsScopeFor,
  useOwnerAnalytics,
  usePlatformAnalytics,
  useOverviewAnalytics,
} from "./hooks/useDashboardAnalytics";
export type {
  AdminFulfillmentsPage,
  ListAdminFulfillmentsParams,
} from "./services/fulfillmentAdmin";
export { notificationService } from "./services/notification";

export { userAdapter } from "./adapters/user";
export type { UserViewModel } from "./adapters/user";
export { cuisineLabel, restaurantAdapter } from "./adapters/restaurant";
export type {
  CuisineType,
  RestaurantStatus,
  RestaurantSummaryResponse,
  RestaurantViewModel,
} from "./adapters/restaurant";
export { menuAdapter, menuItemAdapter, menuItemSearchAdapter } from "./adapters/menu";
export type {
  DietaryTag,
  MenuCategoryViewModel,
  MenuItemResponse,
  MenuItemSearchResponse,
  MenuItemSearchViewModel,
  MenuItemViewModel,
  MenuViewModel,
  RestaurantMenuResponse,
} from "./adapters/menu";
export { cartAdapter } from "./adapters/cart";
export type { CartViewModel } from "./adapters/cart";
export {
  CATALOG_VISIBILITIES,
  CUISINE_TYPES,
  DELIVERY_ZONE_ACTIONS,
  WEEKDAYS,
  ownerRestaurantAdapter,
  toAddCategoryBody,
  toCreateRestaurantBody,
  toManageZoneBody,
  toMajorMoney,
  toMinorMoney,
  toOpeningHoursBody,
  toUpdateCategoryBody,
  toUpdateRestaurantBody,
} from "./adapters/restaurantOwner";
export type {
  CatalogVisibility,
  CategoryFormValues,
  DeliveryZoneAction,
  ManageZoneInput,
  MoneyResponse,
  OpeningHoursInput,
  OwnerRestaurantResponse,
  OwnerRestaurantView,
  RestaurantFormValues,
  UpdateCategoryInput,
  UpdateRestaurantInput,
  Weekday,
} from "./adapters/restaurantOwner";
export {
  DIETARY_TAGS,
  SELECTION_TYPES,
  ownerMenuItemAdapter,
  toAddMenuItemBody,
  toAvailabilityBody,
  toSetVariantsBody,
  toUpdateMenuItemBody,
} from "./adapters/menuOwner";
export type {
  AvailabilityInput,
  MenuItemFormValues,
  OwnerMenuItemResponse,
  OwnerMenuItemView,
  SelectionType,
  UpdateMenuItemInput,
  VariantGroupInput,
  VariantOptionInput,
} from "./adapters/menuOwner";
export { reviewAdapter } from "./adapters/review";
export type { ModerationStatus, ReviewResponse, ReviewView } from "./adapters/review";
export {
  adminDashboardItemAdapter,
  deriveFulfillmentEligibility,
  fulfillmentAdminAdapter,
  CANCELLABLE_FULFILLMENT_STATUSES,
  TERMINAL_FULFILLMENT_STATUSES,
} from "./adapters/fulfillmentAdmin";
export type {
  AdminDashboardItemResponse,
  AdminDashboardItemView,
  CurrentAssignmentResponse,
  FulfillmentAdminResponse,
  FulfillmentAdminView,
  FulfillmentCancellationResponse,
  FulfillmentEligibility,
} from "./adapters/fulfillmentAdmin";
export { restaurantRatingAdapter } from "./adapters/reviewRating";
export type {
  RatingDistributionBar,
  RestaurantRatingResponse,
  RestaurantRatingView,
} from "./adapters/reviewRating";
export {
  extractNotificationLink,
  notificationAdapter,
} from "./adapters/notification";
export type {
  NotificationCategory,
  NotificationChannel,
  NotificationLink,
  NotificationResponse,
  NotificationStatus,
  NotificationVariant,
  NotificationView,
} from "./adapters/notification";
export {
  diffPreferences,
  notificationPreferencesAdapter,
  PREFERENCE_CATEGORIES,
} from "./adapters/notificationPreferences";
export type {
  ChannelToggleResponse,
  NotificationPreferenceResponse,
  NotificationPreferencesView,
  PreferenceChange,
  PreferenceChannelMap,
  PreferenceRow,
} from "./adapters/notificationPreferences";

export { formatMoney } from "./format/money";
export type { Money } from "./format/money";
export { formatDate, formatRelativeTime } from "./format/date";
export { normalizePage } from "./pagination";
export type { NormalizedPage, RawPage } from "./pagination";

export { isEnabled } from "../config/featureFlags";
export type { FeatureFlag } from "../config/featureFlags";

export { queryKeys } from "./queryKeys";

export { useAdminReviews, useApproveReview, useRejectReview } from "./hooks/useReviewModeration";
export {
  useAdminFulfillments,
  useCancelFulfillment,
  useReassignFulfillment,
  useRestaurantFulfillments,
} from "./hooks/useFulfillmentAdmin";
