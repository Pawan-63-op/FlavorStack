export const PERMISSION_RESOURCE = {
   ORDER: "ORDER",
    MENU: "MENU",
    USER: "USER",
    RESTAURANT: "RESTAURANT",
    REVIEW: "REVIEW",
    COUPON: "COUPON",
    REPORT: "REPORT",
    DRIVER: "DRIVER",
    WALLET: "WALLET",
    REFUND: "REFUND",
} as const;
export type PermissionResource = (typeof PERMISSION_RESOURCE)[keyof typeof PERMISSION_RESOURCE]

