// Discount mechanics for the interim Commerce promotion engine (Phase 8).
// PERCENTAGE = a percentage off the eligible subtotal; FIXED = a flat Money amount off.
// Designed to travel unchanged into a future Promotions context.
export const PROMOTION_KIND = {
  PERCENTAGE: "PERCENTAGE",
  FIXED: "FIXED",
} as const;
export type PromotionKind = (typeof PROMOTION_KIND)[keyof typeof PROMOTION_KIND];
