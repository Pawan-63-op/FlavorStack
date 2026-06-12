import { Password } from '../../../../../domain/identity/value-objects/Password.vo';
import { ValidationError } from '../../../../../domain/shared/errors/ValidationError';

describe('Password Value Object', () => {
  it('should create a valid password successfully', () => {
    const passwordResult = Password.create('SecureP@ss123');
    expect(passwordResult.isSuccess).toBe(true);
    expect(passwordResult.getValue().value).toBe('SecureP@ss123');
  });

  it('should fail if password is empty', () => {
    const passwordResult = Password.create('');
    expect(passwordResult.isFailure).toBe(true);
  });

  it('should fail if password is less than 8 characters', () => {
    const passwordResult = Password.create('Abcd1!');
    expect(passwordResult.isFailure).toBe(true);
    expect(passwordResult.getError()).toBeInstanceOf(ValidationError);
  });

  it('should fail if password has no uppercase letter', () => {
    const passwordResult = Password.create('securep@ss123');
    expect(passwordResult.isFailure).toBe(true);
  });

  it('should fail if password has no digit', () => {
    const passwordResult = Password.create('SecureP@ssword');
    expect(passwordResult.isFailure).toBe(true);
  });

  it('should fail if password has no special character', () => {
    const passwordResult = Password.create('SecurePass123');
    expect(passwordResult.isFailure).toBe(true);
  });
});
