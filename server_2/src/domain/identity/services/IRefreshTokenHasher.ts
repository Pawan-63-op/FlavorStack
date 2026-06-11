export interface IRefreshTokenHasher {
  hash(token: string): string;
  compare(token: string, hash: string): boolean;
}
