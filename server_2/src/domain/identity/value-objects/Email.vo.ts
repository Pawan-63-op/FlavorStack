import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { Guard } from '../../shared/Guard';
import { ValidationError } from '../../shared/errors/ValidationError';

interface EmailProps {
  value: string;
}

export class Email extends ValueObject<EmailProps> {
  private constructor(props: EmailProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  public toString(): string {
    return this.props.value;
  }

  public static create(value: any): Result<Email> {
    const emptyCheck = Guard.againstEmptyString(value, 'Email');
    if (emptyCheck.isFailure) {
      return Result.fail<Email>(emptyCheck.getError());
    }

    const trimmed = String(value).trim().toLowerCase();

    // RFC-ish format: single @, domain with TLD (has dot and at least 2 char TLD)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(trimmed)) {
      return Result.fail<Email>(new ValidationError('Invalid email format'));
    }

    return Result.ok<Email>(new Email({ value: trimmed }));
  }
}
