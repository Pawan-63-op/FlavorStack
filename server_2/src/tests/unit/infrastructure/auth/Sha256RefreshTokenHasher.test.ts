import { Sha256RefreshTokenHasher } from '../../../../infrastructure/auth/Sha256RefreshTokenHasher';

describe('Sha256RefreshTokenHasher', () => {
  const hasher = new Sha256RefreshTokenHasher();

  it('produces a deterministic 64-char hex digest for the same token', () => {
    const token = 'refresh-token-abc';

    const hash1 = hasher.hash(token);
    const hash2 = hasher.hash(token);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('compare returns true for a matching token/hash pair', () => {
    const token = 'refresh-token-abc';
    const hash = hasher.hash(token);

    expect(hasher.compare(token, hash)).toBe(true);
  });

  it('compare returns false for a non-matching token', () => {
    const hash = hasher.hash('refresh-token-abc');

    expect(hasher.compare('refresh-token-xyz', hash)).toBe(false);
  });

  it('compare returns false when the stored hash has a different length', () => {
    const hash = hasher.hash('refresh-token-abc');

    expect(hasher.compare('refresh-token-abc', hash.slice(0, -2))).toBe(false);
  });

  it('hashes the full token, so two tokens sharing a 72-byte prefix hash differently and do not cross-compare', () => {
    const sharedPrefix = 'a'.repeat(72);
    const tokenA = `${sharedPrefix}.suffix-A`;
    const tokenB = `${sharedPrefix}.suffix-B`;

    const hashA = hasher.hash(tokenA);
    const hashB = hasher.hash(tokenB);

    expect(hashA).not.toBe(hashB);
    expect(hasher.compare(tokenB, hashA)).toBe(false);
    expect(hasher.compare(tokenA, hashB)).toBe(false);
  });
});
