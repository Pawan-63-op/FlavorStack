import { PermissionResource } from "../enums/permission-resource.enum";
import { PermissionAction } from "../enums/permission-action.enum";
export interface Permission{
    resource:PermissionResource;
    action :PermissionAction;
    scope:string;

 //   methods
    matches(resource:PermissionResource,action:PermissionAction):boolean;

}