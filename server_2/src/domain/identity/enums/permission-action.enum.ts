export const PERMISSION_ACTION = {
    CREATE: "CREATE",
    READ: "READ",
    UPDATE: "UPDATE",
    DELETE: "DELETE",
    MANAGE: "MANAGE",
} as const;
export type PermissionAction = (typeof PERMISSION_ACTION)[keyof typeof PERMISSION_ACTION]

