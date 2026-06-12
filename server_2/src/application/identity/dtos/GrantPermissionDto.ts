import { PermissionResource } from '../../../domain/identity/enums/permission-resource.enum';
import { PermissionAction } from '../../../domain/identity/enums/permission-action.enum';

export interface GrantPermissionDto {
  actorId: string;
  targetAdminId: string;
  resource: PermissionResource;
  action: PermissionAction;
  scope?: string;
}
