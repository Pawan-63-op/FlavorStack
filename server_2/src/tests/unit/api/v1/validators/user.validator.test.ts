import { updateMeSchema } from '../../../../../api/v1/validators/user.validator';

describe('user.validator', () => {
  describe('updateMeSchema', () => {
    it('accepts a payload with only name', () => {
      expect(updateMeSchema.safeParse({ name: 'Jane Doe' }).success).toBe(true);
    });

    it('accepts a payload with only avatarUrl', () => {
      expect(updateMeSchema.safeParse({ avatarUrl: 'https://example.com/avatar.png' }).success).toBe(true);
    });

    it('accepts an empty payload', () => {
      expect(updateMeSchema.safeParse({}).success).toBe(true);
    });

    it('rejects an empty name', () => {
      expect(updateMeSchema.safeParse({ name: '' }).success).toBe(false);
    });

    it('rejects an invalid avatarUrl', () => {
      expect(updateMeSchema.safeParse({ avatarUrl: 'not-a-url' }).success).toBe(false);
    });

    it('rejects disallowed fields (e.g. role, email)', () => {
      expect(updateMeSchema.safeParse({ name: 'Jane', role: 'ADMIN' }).success).toBe(false);
      expect(updateMeSchema.safeParse({ email: 'new@example.com' }).success).toBe(false);
    });
  });
});
