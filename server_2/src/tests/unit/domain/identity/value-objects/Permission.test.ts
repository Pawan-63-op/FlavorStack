import { Permission } from '../../../../../domain/identity/value-objects/Permission.vo';
import { PERMISSION_RESOURCE } from '../../../../../domain/identity/enums/permission-resource.enum';
import { PERMISSION_ACTION } from '../../../../../domain/identity/enums/permission-action.enum';
import { ValidationError } from '../../../../../domain/shared/errors/ValidationError';

describe('Permission Value Object', () => {
  it('should create a valid permission successfully', () => {
    const permResult = Permission.create({
      resource: PERMISSION_RESOURCE.ORDER,
      action: PERMISSION_ACTION.READ,
      scope: 'self'
    });

    expect(permResult.isSuccess).toBe(true);
    const perm = permResult.getValue();
    expect(perm.resource).toBe(PERMISSION_RESOURCE.ORDER);
    expect(perm.action).toBe(PERMISSION_ACTION.READ);
    expect(perm.scope).toBe('self');
    expect(perm.toString()).toBe('ORDER:READ:self');
  });

  it('should create permission without optional scope', () => {
    const permResult = Permission.create({
      resource: PERMISSION_RESOURCE.USER,
      action: PERMISSION_ACTION.CREATE
    });

    expect(permResult.isSuccess).toBe(true);
    expect(permResult.getValue().scope).toBeUndefined();
    expect(permResult.getValue().toString()).toBe('USER:CREATE');
  });

  it('should fail if resource is invalid', () => {
    const permResult = Permission.create({
      resource: 'INVALID_RESOURCE' as any,
      action: PERMISSION_ACTION.READ
    });

    expect(permResult.isFailure).toBe(true);
    expect(permResult.getError()).toBeInstanceOf(ValidationError);
  });

  it('should fail if action is invalid', () => {
    const permResult = Permission.create({
      resource: PERMISSION_RESOURCE.ORDER,
      action: 'INVALID_ACTION' as any
    });

    expect(permResult.isFailure).toBe(true);
    expect(permResult.getError()).toBeInstanceOf(ValidationError);
  });

  it('should evaluate match checks correctly', () => {
    const perm = Permission.create({
      resource: PERMISSION_RESOURCE.ORDER,
      action: PERMISSION_ACTION.READ
    }).getValue();

    expect(perm.matches(PERMISSION_RESOURCE.ORDER, PERMISSION_ACTION.READ)).toBe(true);
    expect(perm.matches(PERMISSION_RESOURCE.ORDER, PERMISSION_ACTION.UPDATE)).toBe(false);
    expect(perm.matches(PERMISSION_RESOURCE.USER, PERMISSION_ACTION.READ)).toBe(false);
  });
});
