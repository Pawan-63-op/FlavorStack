export const FEE_TYPE = {
  PLATFORM: "PLATFORM",
  PACKAGING: "PACKAGING",
  DELIVERY: "DELIVERY",
} as const;
export type FeeType = (typeof FEE_TYPE)[keyof typeof FEE_TYPE]
