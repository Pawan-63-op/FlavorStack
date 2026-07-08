export const USER_ROLE = {
    ADMIN: "ADMIN",
    DRIVER: "DRIVER",
    CUSTOMER: "CUSTOMER",
} as const;
export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE]

