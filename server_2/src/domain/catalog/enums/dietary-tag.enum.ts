export const DIETARY_TAG = {
  VEG: "VEG",
  NON_VEG: "NON_VEG",
  VEGAN: "VEGAN",
  EGG: "EGG",
  HALAL: "HALAL",
} as const;
export type DietaryTag = (typeof DIETARY_TAG)[keyof typeof DIETARY_TAG]
