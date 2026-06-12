// SHA-256 over the full refresh-token JWT — bcrypt's 72-byte truncation would
// collide on the shared header/claim prefix of two of a user's tokens.
import { createHash, timingSafeEqual } from 'crypto';
import { IRefreshTokenHasher } from '../../domain/identity/services/IRefreshTokenHasher';

export class Sha256RefreshTokenHasher implements IRefreshTokenHasher {
  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  compare(token: string, hash: string): boolean {
    const tokenHash = Buffer.from(this.hash(token), 'hex');
    const storedHash = Buffer.from(hash, 'hex');

    if (tokenHash.length !== storedHash.length) {
      return false;
    }

    return timingSafeEqual(tokenHash, storedHash);
  }
}
