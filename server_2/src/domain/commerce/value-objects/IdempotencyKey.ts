import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { Guard } from '../../shared/Guard';
import { ValidationError } from '../../shared/errors/ValidationError';
import { randomUUID } from 'crypto';

interface IdempotencyKeyProps {
  value: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export class IdempotencyKey extends ValueObject<IdempotencyKeyProps> {
  private constructor(props: IdempotencyKeyProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  public static create(value: string): Result<IdempotencyKey> {
    const emptyCheck = Guard.againstEmptyString(value, 'IdempotencyKey');
    if (emptyCheck.isFailure) return Result.fail<IdempotencyKey>(emptyCheck.getError());

    const normalized = value.trim().toLowerCase();
    if (!UUID_REGEX.test(normalized)) {
      return Result.fail<IdempotencyKey>(new ValidationError('IdempotencyKey must be a valid UUID'));
    }

    return Result.ok<IdempotencyKey>(new IdempotencyKey({ value: normalized }));
  }

  /** Mint a fresh key — used when a checkout request omits an explicit Idempotency-Key. */
  public static generate(): IdempotencyKey {
    return new IdempotencyKey({ value: randomUUID() });
  }

  public toString(): string {
    return this.props.value;
  }
}
