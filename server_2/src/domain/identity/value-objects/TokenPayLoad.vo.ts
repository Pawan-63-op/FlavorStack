import { UserRole } from "../enums/user-role.enum";
export interface TokenPayLoad {
    userId: string;
    role: UserRole;
    sessionId: string;
    jti: string;
    iat: number;
    exp: number;
}
