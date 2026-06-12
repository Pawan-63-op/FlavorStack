// Password hashing only — refresh tokens use Sha256RefreshTokenHasher (see that file for why).
import bcrypt from 'bcrypt';
import { IPasswordHasher } from '../../domain/identity/services/IPasswordHasher';

const DEFAULT_BCRYPT_ROUNDS = 12;

export class BcryptPasswordHasher implements IPasswordHasher {
  constructor(private readonly rounds: number = DEFAULT_BCRYPT_ROUNDS) {}

  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.rounds);
  }

  async compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
