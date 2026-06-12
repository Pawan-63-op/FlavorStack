import { DomainError } from './errors/DomainError';

export class Result<T> {
  public readonly isSuccess: boolean;
  public readonly isFailure: boolean;
  private readonly _value?: T;
  private readonly _error?: string | DomainError;

  private constructor(isSuccess: boolean, error?: string | DomainError, value?: T) {
    this.isSuccess = isSuccess;
    this.isFailure = !isSuccess;
    this._error = error;
    this._value = value;

    Object.freeze(this);
  }

  public getValue(): T {
    if (this.isFailure) {
      throw new Error(`Cannot get value of a failure result. Error: ${String(this._error)}`);
    }
    return this._value as T;
  }

  public getError(): string | DomainError {
    if (this.isSuccess) {
      throw new Error('Cannot get error of a success result.');
    }
    return this._error!;
  }

  public static ok<U>(value?: U): Result<U> {
    return new Result<U>(true, undefined, value);
  }

  public static fail<U>(error: string | DomainError): Result<U> {
    return new Result<U>(false, error);
  }

  public static combine(results: Result<any>[]): Result<void> {
    for (const result of results) {
      if (result.isFailure) {
        return Result.fail<void>(result.getError());
      }
    }
    return Result.ok<void>();
  }
}
