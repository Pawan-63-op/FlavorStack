
export const LOYALTY_TIER = {
    BRONZE: "BRONZE",
    SILVER: "SILVER",
    GOLD: "GOLD",
    PLATINUM: "PLATINUM"
} as const;
export type LoyaltyTier = (typeof LOYALTY_TIER)[keyof typeof LOYALTY_TIER]