export const CATALOG_VISIBILITY = {
  PUBLIC: "PUBLIC",
  HIDDEN: "HIDDEN",
  TEST: "TEST",
} as const;
export type CatalogVisibility = (typeof CATALOG_VISIBILITY)[keyof typeof CATALOG_VISIBILITY]
