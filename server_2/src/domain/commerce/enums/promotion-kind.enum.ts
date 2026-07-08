export const PROMOTION_KIND = {
  PERCENTAGE: "PERCENTAGE",
  FIXED: "FIXED",
} as const;
export type PromotionKind = (typeof PROMOTION_KIND)[keyof typeof PROMOTION_KIND];
