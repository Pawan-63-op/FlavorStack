export const AUTH_PROVIDER = {
    LOCAL: "LOCAL",
    GOOGLE: "GOOGLE",
    FACEBOOK: "FACEBOOK",
} as const;
export type AuthProvider = (typeof AUTH_PROVIDER)[keyof typeof AUTH_PROVIDER];
