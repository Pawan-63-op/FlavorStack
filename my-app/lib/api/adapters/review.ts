import { formatDate } from "../format/date";

/**
 * server_2 review DTO → app review view-model.
 *
 * Mapping source: `my-app/integration_phases/Phase_9.md` (frozen server_2
 * `/restaurants/:id/reviews` + `/me/reviews` contract, engagement context
 * `ReviewResponse`). Dual rating (`restaurantRating` required,
 * `deliveryRating` optional), verified-purchase via `fulfillmentId`. The
 * server carries no author name/avatar, so the UI shows a generic label.
 */

export type ModerationStatus = "PENDING" | "AUTO_FLAGGED" | "APPROVED" | "REJECTED";

export interface ReviewResponse {
  reviewId: string;
  customerId: string;
  restaurantId: string;
  fulfillmentId: string;
  restaurantRating: number;
  deliveryRating: number | null;
  comment: string | null;
  moderationStatus: string;
  createdAt: string;
  moderatedAt?: string;
  moderatedBy?: string;
}

export interface ReviewView {
  id: string;
  customerId: string;
  restaurantId: string;
  fulfillmentId: string;
  restaurantRating: number;
  deliveryRating: number | null;
  comment: string | null;
  moderationStatus: ModerationStatus;
  /** Human label for `moderationStatus`. */
  moderationStatusLabel: string;
  /** `true` once the server marks the review `APPROVED` (publicly visible). */
  isPublished: boolean;
  createdAt: string;
  /** Medium-style ("Jun 22, 2026") rendering of `createdAt`. */
  formattedDate: string;
  /** Generic author label — server carries no name/avatar. */
  authorLabel: string;
}

const GENERIC_AUTHOR_LABEL = "Verified customer";

/** Moderation status → human label. `PENDING`/`AUTO_FLAGGED` both read as "pending". */
const MODERATION_STATUS_LABELS: Record<ModerationStatus, string> = {
  PENDING: "Pending review",
  AUTO_FLAGGED: "Pending review",
  APPROVED: "Published",
  REJECTED: "Rejected",
};

/**
 * Pure DTO→view-model map. Single-argument so it is safe to use directly with
 * `Array.prototype.map`.
 */
export function reviewAdapter(dto: ReviewResponse): ReviewView {
  const moderationStatus = dto.moderationStatus as ModerationStatus;
  return {
    id: dto.reviewId,
    customerId: dto.customerId,
    restaurantId: dto.restaurantId,
    fulfillmentId: dto.fulfillmentId,
    restaurantRating: dto.restaurantRating,
    deliveryRating: dto.deliveryRating ?? null,
    comment: dto.comment ?? null,
    moderationStatus,
    moderationStatusLabel: MODERATION_STATUS_LABELS[moderationStatus] ?? moderationStatus,
    isPublished: moderationStatus === "APPROVED",
    createdAt: dto.createdAt,
    formattedDate: formatDate(dto.createdAt),
    authorLabel: GENERIC_AUTHOR_LABEL,
  };
}
