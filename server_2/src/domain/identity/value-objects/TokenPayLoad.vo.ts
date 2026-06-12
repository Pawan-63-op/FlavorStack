import { UserRole } from "../enums/user-role.enum";
export interface TokenPayLoad {
    userId: string;
    role: UserRole;
    sessionId: string;
    jti: string;
    tokenVersion: number;
    iat: number;
    exp: number;
}
