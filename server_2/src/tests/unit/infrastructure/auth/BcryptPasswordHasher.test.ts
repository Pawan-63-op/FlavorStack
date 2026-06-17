import { BcryptPasswordHasher } from '../../../../infrastructure/auth/BcryptPasswordHasher';

describe('BcryptPasswordHasher', () => {
  it('hash() returns a value different from the plaintext', async () => {
    const hasher = new BcryptPasswordHasher(4);

    const hash = await hasher.hash('S3cret!Pass');

    expect(hash).not.toBe('S3cret!Pass');
  });

  it('compare() returns true for a matching plaintext/hash pair', async () => {
    const hasher = new BcryptPasswordHasher(4);
    const hash = await hasher.hash('S3cret!Pass');

    expect(await hasher.compare('S3cret!Pass', hash)).toBe(true);
  });

  it('compare() returns false for a mismatching plaintext', async () => {
    const hasher = new BcryptPasswordHasher(4);
    const hash = await hasher.hash('S3cret!Pass');

    expect(await hasher.compare('WrongPass1!', hash)).toBe(false);
  });

  it('produces distinct hashes for the same input due to per-hash salts', async () => {
    const hasher = new BcryptPasswordHasher(4);

    const hash1 = await hasher.hash('S3cret!Pass');
    const hash2 = await hasher.hash('S3cret!Pass');

    expect(hash1).not.toBe(hash2);
  });

  it('encodes the configured cost factor in the hash', async () => {
    const hasher = new BcryptPasswordHasher(4);

    const hash = await hasher.hash('S3cret!Pass');

    expect(hash).toMatch(/^\$2[aby]\$04\$/);
  });

  it('defaults to 12 rounds when none is provided', async () => {
    const hasher = new BcryptPasswordHasher();

    const hash = await hasher.hash('S3cret!Pass');

    expect(hash).toMatch(/^\$2[aby]\$12\$/);
  });
});
