import {
  objectId,
  userIdParam,
  adminIdParam,
  sessionIdParam,
  paginationSchema,
} from '../../../../../api/v1/validators/common.validator';

describe('common.validator', () => {
  describe('objectId', () => {
    it('accepts a valid UUID id', () => {
      expect(objectId.safeParse('3fa85f64-5717-4562-b3fc-2c963f66afa6').success).toBe(true);
    });

    it('rejects a non-uuid string', () => {
      expect(objectId.safeParse('not-an-id').success).toBe(false);
      expect(objectId.safeParse('507f1f77bcf86cd799439011').success).toBe(false);
    });
  });

  describe('userIdParam', () => {
    it('accepts a valid userId param', () => {
      const result = userIdParam.safeParse({ userId: '3fa85f64-5717-4562-b3fc-2c963f66afa6' });
      expect(result.success).toBe(true);
    });

    it('rejects an invalid userId param', () => {
      expect(userIdParam.safeParse({ userId: 'bad' }).success).toBe(false);
    });
  });

  describe('adminIdParam', () => {
    it('accepts a valid adminId param', () => {
      const result = adminIdParam.safeParse({ adminId: '3fa85f64-5717-4562-b3fc-2c963f66afa6' });
      expect(result.success).toBe(true);
    });

    it('rejects an invalid adminId param', () => {
      expect(adminIdParam.safeParse({ adminId: 'bad' }).success).toBe(false);
    });
  });

  describe('sessionIdParam', () => {
    it('accepts a valid uuid sessionId param', () => {
      const result = sessionIdParam.safeParse({ sessionId: '3fa85f64-5717-4562-b3fc-2c963f66afa6' });
      expect(result.success).toBe(true);
    });

    it('rejects a non-uuid sessionId param', () => {
      expect(sessionIdParam.safeParse({ sessionId: 'not-a-uuid' }).success).toBe(false);
    });
  });

  describe('paginationSchema', () => {
    it('applies defaults when nothing is provided', () => {
      const result = paginationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ page: 1, limit: 20 });
      }
    });

    it('coerces numeric strings from query params', () => {
      const result = paginationSchema.safeParse({ page: '2', limit: '50' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ page: 2, limit: 50 });
      }
    });

    it('rejects a limit above the max', () => {
      expect(paginationSchema.safeParse({ limit: '500' }).success).toBe(false);
    });
  });
});
