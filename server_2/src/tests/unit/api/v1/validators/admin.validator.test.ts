import { assignRoleSchema, grantPermissionSchema, banSchema } from '../../../../../api/v1/validators/admin.validator';

describe('admin.validator', () => {
  describe('assignRoleSchema', () => {
    it('accepts a valid role', () => {
      expect(assignRoleSchema.safeParse({ role: 'DRIVER' }).success).toBe(true);
    });

    it('rejects an invalid role', () => {
      expect(assignRoleSchema.safeParse({ role: 'SUPERHERO' }).success).toBe(false);
    });

    it('rejects a missing role', () => {
      expect(assignRoleSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('grantPermissionSchema', () => {
    it('accepts a valid resource/action without scope', () => {
      const result = grantPermissionSchema.safeParse({ resource: 'ORDER', action: 'READ' });
      expect(result.success).toBe(true);
    });

    it('accepts a valid resource/action with scope', () => {
      const result = grantPermissionSchema.safeParse({ resource: 'ORDER', action: 'READ', scope: 'region:us' });
      expect(result.success).toBe(true);
    });

    it('rejects an invalid resource', () => {
      expect(grantPermissionSchema.safeParse({ resource: 'NOT_A_RESOURCE', action: 'READ' }).success).toBe(false);
    });

    it('rejects an invalid action', () => {
      expect(grantPermissionSchema.safeParse({ resource: 'ORDER', action: 'NOT_AN_ACTION' }).success).toBe(false);
    });
  });

  describe('banSchema', () => {
    it('accepts a payload with a reason', () => {
      expect(banSchema.safeParse({ reason: 'Repeated policy violations' }).success).toBe(true);
    });

    it('rejects an empty reason', () => {
      expect(banSchema.safeParse({ reason: '' }).success).toBe(false);
    });

    it('rejects a missing reason', () => {
      expect(banSchema.safeParse({}).success).toBe(false);
    });
  });
});
