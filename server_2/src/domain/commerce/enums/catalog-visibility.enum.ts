// Commerce-local mirror of catalog's CATALOG_VISIBILITY (domain/catalog/enums/catalog-visibility.enum.ts).
// Duplicated rather than imported so CartValidator never depends on domain/catalog types,
// matching the decoupling stance of CommerceCatalogView.ts.
export const COMMERCE_CATALOG_VISIBILITY = {
  PUBLIC: "PUBLIC",
  HIDDEN: "HIDDEN",
  TEST: "TEST",
} as const;
export type CommerceCatalogVisibility = (typeof COMMERCE_CATALOG_VISIBILITY)[keyof typeof COMMERCE_CATALOG_VISIBILITY]
