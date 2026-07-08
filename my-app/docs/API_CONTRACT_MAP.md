# API Contract Map — FE call → `/api/v1` endpoint → adapter

> **Regenerate from source of truth:** `lib/api/services/*.ts` (endpoint strings)
> + `lib/api/adapters/*.ts` (DTO → view-model mappings). This table is a
> human-readable index of those files; when a service method or adapter changes,
> update the matching row here.

Every customer/admin FE call goes through a **service method** (`lib/api/services/*.ts`),
which calls the shared HTTP client (`lib/api/client/http.ts`, base URL
`NEXT_PUBLIC_API_BASE_URL || /api/v1`, single-flight 401→refresh applied), and
maps the server_2 DTO into a **view-model** via a pure **adapter**
(`lib/api/adapters/*.ts`). Paths below are **relative to `/api/v1`**.

## Pagination styles

| Style | Meaning | Where |
| ----- | ------- | ----- |
| `normalizePage` | Raw cursor- **or** offset-shaped page (`lib/api/pagination.ts`) normalised to `{ items, nextCursor?, hasMore }`. Offset pages compute `hasMore = offset + items.length < total`; cursor pages set `hasMore = Boolean(nextCursor)`. | catalog list/search/nearby |
| `offset + length-derived` | Server returns a **bare array** (no envelope, no total); the service requests `limit+offset` and derives `hasMore` from the returned length. | notifications, reviews, admin fulfillment/review lists |
| `none` | Single resource or full collection; no pagination. | reads/writes of one entity, snapshots, ratings |

---

## auth / user — `services/auth.ts` (Phase 1; OTP Phase 2)

| Service method | Verb + path | Adapter | Pagination |
| -------------- | ----------- | ------- | ---------- |
| `login({email,password})` | `POST /auth/login` | `userAdapter` (on `res.user`) | none |
| `logout()` | `POST /auth/logout` | — | none |
| `me()` | `GET /users/me` | `userAdapter` | none |
| `updateMe({name?,avatarUrl?})` | `PATCH /users/me` | `userAdapter` | none |
| `register(input)` | `POST /auth/register` | `registerAdapter` (request) → `userAdapter` (response) | none |
| `sendEmailOtp()` | `POST /auth/email-otp/send` | — | none |
| `verifyEmailOtp(code)` | `POST /auth/email-otp/verify` | — | none |
| `sendPhoneOtp(phone)` | `POST /auth/phone-otp/send` | — | none |
| `verifyPhoneOtp(code)` | `POST /auth/phone-otp/verify` | — | none |
| `forgotPassword(email)` | `POST /auth/forgot-password` | — | none |
| `resetPassword({email,code,newPassword})` | `POST /auth/reset-password` | — | none |

> Token refresh (`POST /auth/refresh`) is invoked by the client interceptor
> `withRefresh.ts`, not a service method. See `AUTH_FLOWS.md`.

## catalog (restaurants + menus, read) — `services/catalog.ts` (Phase 4; serviceability/nearby behind `nearby`)

| Service method | Verb + path | Adapter | Pagination |
| -------------- | ----------- | ------- | ---------- |
| `listRestaurants(params)` | `GET /catalog/restaurants` | `restaurantAdapter` | `normalizePage` |
| `getRestaurant(id)` | `GET /catalog/restaurants/:id` | `restaurantAdapter` | none |
| `getMenu(restaurantId)` | `GET /catalog/restaurants/:id/menu` | `menuAdapter` | none |
| `getItem(id)` | `GET /catalog/items/:id` | `menuItemAdapter` | none |
| `getItemsSnapshot(ids)` | `GET /catalog/items/snapshot?ids=` | `menuItemAdapter` (per item) | none |
| `searchRestaurants(params)` | `GET /catalog/search/restaurants` | `restaurantAdapter` | `normalizePage` |
| `searchItems(params)` | `GET /catalog/search/items` | `menuItemSearchAdapter` | `normalizePage` |
| `nearby(params)` | `GET /catalog/nearby` | `restaurantAdapter` | `normalizePage` |
| `serviceability(params)` | `GET /catalog/serviceability` | `serviceabilityAdapter` (local) | none |
| `getRating(restaurantId)` | `GET /restaurants/:id/rating` | — (raw `RestaurantRatingResponse`) | none |

## catalog owner-write — `services/catalogOwner.ts` (Phase 10, behind `admin`)

| Service method | Verb + path | Adapter | Pagination |
| -------------- | ----------- | ------- | ---------- |
| `createRestaurant(form)` | `POST /catalog/restaurants` | `ownerRestaurantAdapter` | none |
| `updateRestaurant(id,form)` | `PATCH /catalog/restaurants/:id` | `ownerRestaurantAdapter` | none |
| `deleteRestaurant(id)` | `DELETE /catalog/restaurants/:id` | — | none |
| `publish/pause/close(id)` | `POST /catalog/restaurants/:id/:action` | `ownerRestaurantAdapter` | none |
| `setVisibility(id,…)` | `PATCH /catalog/restaurants/:id/visibility` | `ownerRestaurantAdapter` | none |
| `setOpeningHours(id,…)` | `PUT /catalog/restaurants/:id/opening-hours` | `ownerRestaurantAdapter` | none |
| `uploadRestaurantImage(id,…)` | `POST /catalog/restaurants/:id/image` | `ownerRestaurantAdapter` | none |
| `addCategory(id,…)` | `POST /catalog/restaurants/:id/categories` | `ownerRestaurantAdapter` | none |
| `reorderCategories(id,…)` | `POST /catalog/restaurants/:id/categories/reorder` | `ownerRestaurantAdapter` | none |
| `updateCategory(id,categoryId,…)` | `PATCH /catalog/restaurants/:id/categories/:categoryId` | `ownerRestaurantAdapter` | none |
| `removeCategory(id,categoryId)` | `DELETE /catalog/restaurants/:id/categories/:categoryId` | `ownerRestaurantAdapter` | none |
| `manageZone(id,…)` | `POST /catalog/restaurants/:id/zones` | `ownerRestaurantAdapter` | none |
| `addItem(restaurantId,…)` | `POST /catalog/restaurants/:id/items` | `ownerMenuItemAdapter` | none |
| `updateItem(itemId,…)` | `PATCH /catalog/items/:itemId` | `ownerMenuItemAdapter` | none |
| `removeItem(itemId)` | `DELETE /catalog/items/:itemId` | — | none |
| `setAvailability(itemId,…)` | `PATCH /catalog/items/:itemId/availability` | `ownerMenuItemAdapter` | none |
| `setVariants(itemId,…)` | `PUT /catalog/items/:itemId/variants` | `ownerMenuItemAdapter` | none |
| `uploadItemImage(itemId,…)` | `POST /catalog/items/:itemId/image` | `ownerMenuItemAdapter` | none |

## cart — `services/cart.ts` (Phase 5)

| Service method | Verb + path | Adapter | Pagination |
| -------------- | ----------- | ------- | ---------- |
| `getCart()` | `GET /cart` | `cartAdapter` | none |
| `getSummary()` | `GET /cart/summary` | `cartSummaryAdapter` | none |
| `addItem(input)` | `POST /cart/items` | `cartAdapter` | none |
| `updateItem(cartItemId,qty)` | `PATCH /cart/items/:itemId` (qty 0 ⇒ remove) | `cartAdapter` | none |
| `removeItem(cartItemId)` | `DELETE /cart/items/:itemId` | `cartAdapter` | none |
| `clearCart()` | `DELETE /cart` | `cartAdapter` | none |
| `applyPromotion(code)` | `POST /cart/promotion` | `cartAdapter` | none |
| `validatePromotion(code)` | `POST /cart/promotion/validate` | — (raw `ValidatePromotionResponseDto`) | none |
| `removePromotion()` | `DELETE /cart/promotion` | `cartAdapter` | none |

## checkout — `services/checkout.ts` (Phase 6)

| Service method | Verb + path | Adapter | Pagination |
| -------------- | ----------- | ------- | ---------- |
| `preview(deliveryPoint)` | `POST /checkout/preview` (no Idempotency-Key) | `checkoutPreviewAdapter` | none |
| `checkout(input)` | `POST /checkout` (always sends Idempotency-Key) | `orderConfirmationAdapter` | none |
| `getOrderRequest(id)` | `GET /order-requests/:id` | `orderConfirmationAdapter` | none |

> Failures on `preview`/`checkout` are reported via the observability reporter
> (`checkout.failure` metric + `captureError` with `requestId`) and rethrown
> unchanged — see Phase 12.4 / `lib/observability/`.

## tracking — `services/tracking.ts` (Phase 7, behind `tracking`)

| Service method | Verb + path | Adapter | Pagination |
| -------------- | ----------- | ------- | ---------- |
| `getTracking(fulfillmentId)` | `GET /fulfillments/:id/tracking` | `trackingAdapter` | none |

> Live updates use Socket.IO `/tracking` namespace (not REST); proxied
> same-origin in prod. See `DEPLOYMENT.md`.

## notifications — `services/notification.ts` (Phase 8, behind `notifications`)

| Service method | Verb + path | Adapter | Pagination |
| -------------- | ----------- | ------- | ---------- |
| `listNotifications(params)` | `GET /me/notifications?limit&offset` | `notificationAdapter` | offset + length-derived |
| `getUnreadCount()` | `GET /me/notifications/unread-count` | — (`{count}`) | none |
| `markRead(id)` | `PATCH /me/notifications/:id/read` | — | none |
| `getPreferences()` | `GET /me/notification-preferences` | `notificationPreferencesAdapter` | none |
| `updatePreferences(changes)` | `PUT /me/notification-preferences` | `notificationPreferencesAdapter` | none |

## reviews (read + create) — `services/review.ts` (Phase 9, behind `reviews`)

| Service method | Verb + path | Adapter | Pagination |
| -------------- | ----------- | ------- | ---------- |
| `listRestaurantReviews(id,params)` | `GET /restaurants/:id/reviews?limit&offset` (APPROVED, public) | `reviewAdapter` | offset + length-derived |
| `listMyReviews(params)` | `GET /me/reviews?limit&offset` (all statuses, authed) | `reviewAdapter` | offset + length-derived |
| `getRestaurantRating(id)` | `GET /restaurants/:id/rating` | `restaurantRatingAdapter` | none |
| `createReview(input)` | `POST /restaurants/:id/reviews` (dual-rating body) | `reviewAdapter` | none |

## review moderation (admin) — `services/reviewModeration.ts` (Phase 11, behind `adminOps`)

| Service method | Verb + path | Adapter | Pagination |
| -------------- | ----------- | ------- | ---------- |
| `listAdminReviews(params)` | `GET /admin/reviews?status&limit&offset` (defaults PENDING) | `reviewAdapter` | offset + length-derived |
| `approveReview(id,reason?)` | `POST /admin/reviews/:id/approve` | `reviewAdapter` | none |
| `rejectReview(id,reason?)` | `POST /admin/reviews/:id/reject` | `reviewAdapter` | none |

## fulfillment admin — `services/fulfillmentAdmin.ts` (Phase 11, behind `adminOps`; restaurant queue gated by ownership)

| Service method | Verb + path | Adapter | Pagination |
| -------------- | ----------- | ------- | ---------- |
| `listAdminFulfillments(params)` | `GET /admin/fulfillments?status&slaBreached&restaurantId&limit&offset` | `adminDashboardItemAdapter` | offset + length-derived |
| `reassignFulfillment(id,riderId?)` | `POST /admin/fulfillments/:id/reassign` | `fulfillmentAdminAdapter` | none |
| `cancelFulfillment(id,reason)` | `POST /admin/fulfillments/:id/cancel` (reason 1–500 chars) | `fulfillmentAdminAdapter` | none |
| `listRestaurantFulfillments(restaurantId,params)` | `GET /restaurants/:id/fulfillments?status` | `fulfillmentAdminAdapter` | none (full collection) |
