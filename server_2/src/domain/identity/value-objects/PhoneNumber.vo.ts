import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { Guard } from '../../shared/Guard';
import { ValidationError } from '../../shared/errors/ValidationError';

interface PhoneNumberProps {
  value: string;
}

export class PhoneNumber extends ValueObject<PhoneNumberProps> {
  private constructor(props: PhoneNumberProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  public toString(): string {
    return this.props.value;
  }

  public static create(value: any): Result<PhoneNumber> {
    const emptyCheck = Guard.againstEmptyString(value, 'PhoneNumber');
    if (emptyCheck.isFailure) {
      return Result.fail<PhoneNumber>(emptyCheck.getError());
    }

    // Normalize: strip spaces, dashes, parentheses
    const normalized = String(value).replace(/[\s\-()]/g, '');

    // Validate E.164 format: + followed by 8 to 15 digits
    const e164Regex = /^\+[1-9]\d{7,14}$/;
    if (!e164Regex.test(normalized)) {
      return Result.fail<PhoneNumber>(
        new ValidationError('Phone number must be in valid E.164 format (e.g., +1234567890)')
      );
    }

    return Result.ok<PhoneNumber>(new PhoneNumber({ value: normalized }));
  }
}
