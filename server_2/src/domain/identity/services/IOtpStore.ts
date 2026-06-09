import { Result } from '../../shared/Result';

export interface IOtpStore {
  issue(key: string, code: string, ttlSeconds: number): Promise<void>;
  verify(key: string, code: string): Promise<Result<void>>;
  consume(key: string): Promise<void>;
}
