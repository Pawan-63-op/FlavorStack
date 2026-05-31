export const TOKEN_TYPE = {
    ACCESS: "ACCESS",
    REFRESH: "REFRESH",
    EMAIL_VERIFY: "EMAIL_VERIFY",
    PASSWORD_RESET: "PASSWORD_RESET"
} as const;
export type TokenType = (typeof TOKEN_TYPE)[keyof typeof TOKEN_TYPE]

