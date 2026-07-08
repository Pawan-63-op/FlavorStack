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
