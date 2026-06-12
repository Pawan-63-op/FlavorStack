import { Result } from './Result';
import { ValidationError } from './errors/ValidationError';

export interface GuardArgument {
  value: any;
  argName: string;
}

export class Guard {
  public static againstNullOrUndefined(value: any, argName: string): Result<void> {
    if (value === null || value === undefined) {
      return Result.fail<void>(new ValidationError(`${argName} is null or undefined`));
    }
    return Result.ok<void>();
  }

  public static againstNullOrUndefinedBulk(args: GuardArgument[]): Result<void> {
    for (const arg of args) {
      const result = this.againstNullOrUndefined(arg.value, arg.argName);
      if (result.isFailure) {
        return result;
      }
    }
    return Result.ok<void>();
  }

  public static againstEmptyString(value: any, argName: string): Result<void> {
    const nullOrUndefinedResult = this.againstNullOrUndefined(value, argName);
    if (nullOrUndefinedResult.isFailure) {
      return nullOrUndefinedResult;
    }
    if (typeof value !== 'string' || value.trim().length === 0) {
      return Result.fail<void>(new ValidationError(`${argName} is an empty string`));
    }
    return Result.ok<void>();
  }

  public static againstAtLeast(min: number, value: number, argName = 'Value'): Result<void> {
    if (value < min) {
      return Result.fail<void>(new ValidationError(`${argName} must be at least ${min}`));
    }
    return Result.ok<void>();
  }

  public static againstAtMost(max: number, value: number, argName = 'Value'): Result<void> {
    if (value > max) {
      return Result.fail<void>(new ValidationError(`${argName} must be at most ${max}`));
    }
    return Result.ok<void>();
  }

  public static inRange(num: number, min: number, max: number, argName: string): Result<void> {
    if (num < min || num > max) {
      return Result.fail<void>(new ValidationError(`${argName} must be between ${min} and ${max}`));
    }
    return Result.ok<void>();
  }

  public static isOneOf(value: any, validValues: any[], argName: string): Result<void> {
    if (!validValues.includes(value)) {
      return Result.fail<void>(new ValidationError(`${argName} must be one of: [${validValues.join(', ')}]`));
    }
    return Result.ok<void>();
  }
}
