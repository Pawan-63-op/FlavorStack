import { ObjectId } from "mongodb";
import { UserRole } from "../enums/user-role.enum";
export interface TokenPayLoad {
    userId: ObjectId;
    role: UserRole;
    sessionId: string;
    jti: string;
    iat: number;
    exp: number;
}
