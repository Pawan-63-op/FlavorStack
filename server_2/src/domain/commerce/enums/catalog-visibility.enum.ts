export const COMMERCE_CATALOG_VISIBILITY = {
  PUBLIC: "PUBLIC",
  HIDDEN: "HIDDEN",
  TEST: "TEST",
} as const;
export type CommerceCatalogVisibility = (typeof COMMERCE_CATALOG_VISIBILITY)[keyof typeof COMMERCE_CATALOG_VISIBILITY]
