import { BaseUser } from '../entities/BaseUser';
import { Admin } from '../entities/Admin';
import { UserRole } from '../enums/user-role.enum';
import { PermissionResource } from '../enums/permission-resource.enum';
import { PermissionAction } from '../enums/permission-action.enum';
import { Result } from '../../shared/Result';

export interface IRbacService {
  can(admin: Admin, resource: PermissionResource, action: PermissionAction): boolean;
  hasRole(user: BaseUser, role: UserRole): boolean;
  authorize(admin: Admin, resource: PermissionResource, action: PermissionAction): Result<void>;
}
