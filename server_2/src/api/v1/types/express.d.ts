// Augments Express Request with the verified JWT claims and per-request context
import { UserRole } from '../../../domain/identity/enums/user-role.enum';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: UserRole;
        sessionId: string;
        jti: string;
        tokenVersion: number;
      };
      context: {
        requestId: string;
        ip: string;
        userAgent?: string;
        device?: string;
      };
      // Canonical (trimmed, lower-cased) Idempotency-Key for the checkout command,
      // set by the requireIdempotencyKey middleware (commerce_module.md §4.4 step 0).
      idempotencyKey?: string;
    }
  }
}

export {};
