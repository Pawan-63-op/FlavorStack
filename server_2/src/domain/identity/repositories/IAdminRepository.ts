import { Admin } from '../entities/Admin';
import { PermissionResource } from '../enums/permission-resource.enum';
import { PermissionAction } from '../enums/permission-action.enum';

export interface IAdminRepository {
  findByPermission(resource: PermissionResource, action: PermissionAction): Promise<Admin[]>;
}
