// Zod schemas for admin-only identity routes
import { z } from 'zod';
import { USER_ROLE } from '../../../domain/identity/enums/user-role.enum';
import { PERMISSION_RESOURCE } from '../../../domain/identity/enums/permission-resource.enum';
import { PERMISSION_ACTION } from '../../../domain/identity/enums/permission-action.enum';

export const assignRoleSchema = z.object({
  role: z.nativeEnum(USER_ROLE),
});

export const grantPermissionSchema = z.object({
  resource: z.nativeEnum(PERMISSION_RESOURCE),
  action: z.nativeEnum(PERMISSION_ACTION),
  scope: z.string().optional(),
});

export const banSchema = z.object({
  reason: z.string().min(1),
});
