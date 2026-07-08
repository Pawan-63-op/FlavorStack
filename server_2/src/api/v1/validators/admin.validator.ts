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

export const listDriversQuerySchema = z.object({
  status: z.string().optional(),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  role: z.string().optional(),
  search: z.string().trim().min(1).max(120).optional(),
});
