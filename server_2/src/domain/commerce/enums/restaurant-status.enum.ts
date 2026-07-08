export const COMMERCE_RESTAURANT_STATUS = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  CLOSED: "CLOSED",
} as const;
export type CommerceRestaurantStatus = (typeof COMMERCE_RESTAURANT_STATUS)[keyof typeof COMMERCE_RESTAURANT_STATUS]
