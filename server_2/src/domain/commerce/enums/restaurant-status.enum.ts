// Commerce-local mirror of catalog's RESTAURANT_STATUS (domain/catalog/enums/restaurant-status.enum.ts).
// Duplicated rather than imported so CartValidator never depends on domain/catalog types,
// matching the decoupling stance of CommerceCatalogView.ts.
export const COMMERCE_RESTAURANT_STATUS = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  CLOSED: "CLOSED",
} as const;
export type CommerceRestaurantStatus = (typeof COMMERCE_RESTAURANT_STATUS)[keyof typeof COMMERCE_RESTAURANT_STATUS]
