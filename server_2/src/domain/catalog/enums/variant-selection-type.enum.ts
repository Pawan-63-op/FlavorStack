export const VARIANT_SELECTION_TYPE = {
  SINGLE: "SINGLE",
  MULTI: "MULTI",
} as const;
export type VariantSelectionType = (typeof VARIANT_SELECTION_TYPE)[keyof typeof VARIANT_SELECTION_TYPE]
