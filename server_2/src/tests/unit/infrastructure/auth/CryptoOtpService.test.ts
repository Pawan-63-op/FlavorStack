import { CryptoOtpService } from '../../../../infrastructure/auth/CryptoOtpService';

describe('CryptoOtpService', () => {
  const service = new CryptoOtpService();

  it('defaults to a 6-digit code', () => {
    expect(service.generate()).toHaveLength(6);
  });

  it('honors a custom length', () => {
    expect(service.generate(4)).toHaveLength(4);
    expect(service.generate(10)).toHaveLength(10);
  });

  it('returns digits only', () => {
    for (let i = 0; i < 50; i++) {
      expect(service.generate()).toMatch(/^\d+$/);
    }
  });

  it('preserves leading zeros (always returns the requested length)', () => {
    for (let i = 0; i < 200; i++) {
      expect(service.generate(6)).toHaveLength(6);
    }
  });

  it('produces a reasonable spread of digits across many samples (no obvious bias)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      for (const digit of service.generate(6)) {
        seen.add(digit);
      }
    }

    expect(seen.size).toBeGreaterThanOrEqual(8);
  });
});
