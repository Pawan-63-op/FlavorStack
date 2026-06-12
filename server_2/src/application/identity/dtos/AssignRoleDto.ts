import { UserRole } from '../../../domain/identity/enums/user-role.enum';

export interface AssignRoleDto {
  actorId: string;
  targetUserId: string;
  role: UserRole;
}
