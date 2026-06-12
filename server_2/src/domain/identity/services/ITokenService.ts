import { TokenPayLoad } from '../value-objects/TokenPayLoad.vo';
import { Result } from '../../shared/Result';

export interface ITokenService {
  generateAccessToken(payload: TokenPayLoad): string;
  generateRefreshToken(payload: TokenPayLoad): string;
  verify(token: string): Result<TokenPayLoad>;
  decode(token: string): TokenPayLoad | null;
}
