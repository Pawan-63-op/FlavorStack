/**
 * Transient Value Object for validating plaintext passwords.
 * This is never persisted in its raw form; it gates input strength
 * before hashing occurs in the infrastructure/application layer.
 */
import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { Guard } from '../../shared/Guard';
import { ValidationError } from '../../shared/errors/ValidationError';

interface PasswordProps {
  value: string;
}

export class Password extends ValueObject<PasswordProps> {
  private constructor(props: PasswordProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  public static create(value: any): Result<Password> {
    const emptyCheck = Guard.againstEmptyString(value, 'Password');
    if (emptyCheck.isFailure) {
      return Result.fail<Password>(emptyCheck.getError());
    }

    const passwordStr = String(value);

    // Min 8 characters
    const lengthCheck = Guard.againstAtLeast(8, passwordStr.length, 'Password length');
    if (lengthCheck.isFailure) {
      return Result.fail<Password>(lengthCheck.getError());
    }

    // Must contain at least one uppercase letter
    if (!/[A-Z]/.test(passwordStr)) {
      return Result.fail<Password>(new ValidationError('Password must contain at least one uppercase letter'));
    }

    // Must contain at least one number
    if (!/[0-9]/.test(passwordStr)) {
      return Result.fail<Password>(new ValidationError('Password must contain at least one digit'));
    }

    // Must contain at least one special character
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(passwordStr)) {
      return Result.fail<Password>(new ValidationError('Password must contain at least one special character'));
    }

    return Result.ok<Password>(new Password({ value: passwordStr }));
  }
}
