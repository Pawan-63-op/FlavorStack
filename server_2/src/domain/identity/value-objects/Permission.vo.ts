import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { Guard } from '../../shared/Guard';
import { PermissionResource, PERMISSION_RESOURCE } from '../enums/permission-resource.enum';
import { PermissionAction, PERMISSION_ACTION } from '../enums/permission-action.enum';

interface PermissionProps {
  resource: PermissionResource;
  action: PermissionAction;
  scope?: string;
}

export class Permission extends ValueObject<PermissionProps> {
  private constructor(props: PermissionProps) {
    super(props);
  }

  get resource(): PermissionResource {
    return this.props.resource;
  }

  get action(): PermissionAction {
    return this.props.action;
  }

  get scope(): string | undefined {
    return this.props.scope;
  }

  public matches(resource: PermissionResource, action: PermissionAction, scope?: string): boolean {
    if (this.props.resource !== resource || this.props.action !== action) {
      return false;
    }
    // Scope only constrains the match when this permission carries one.
    if (this.props.scope !== undefined) {
      return this.props.scope === scope;
    }
    return true;
  }

  public toString(): string {
    return this.props.scope
      ? `${this.props.resource}:${this.props.action}:${this.props.scope}`
      : `${this.props.resource}:${this.props.action}`;
  }

  public static create(props: {
    resource: PermissionResource;
    action: PermissionAction;
    scope?: string;
  }): Result<Permission> {
    const resourceCheck = Guard.againstNullOrUndefined(props.resource, 'Resource');
    if (resourceCheck.isFailure) return Result.fail<Permission>(resourceCheck.getError());

    const actionCheck = Guard.againstNullOrUndefined(props.action, 'Action');
    if (actionCheck.isFailure) return Result.fail<Permission>(actionCheck.getError());

    const validResources = Object.values(PERMISSION_RESOURCE);
    const resourceEnumCheck = Guard.isOneOf(props.resource, validResources, 'Resource');
    if (resourceEnumCheck.isFailure) return Result.fail<Permission>(resourceEnumCheck.getError());

    const validActions = Object.values(PERMISSION_ACTION);
    const actionEnumCheck = Guard.isOneOf(props.action, validActions, 'Action');
    if (actionEnumCheck.isFailure) return Result.fail<Permission>(actionEnumCheck.getError());

    return Result.ok<Permission>(
      new Permission({
        resource: props.resource,
        action: props.action,
        scope: props.scope ? String(props.scope).trim() : undefined,
      })
    );
  }
}