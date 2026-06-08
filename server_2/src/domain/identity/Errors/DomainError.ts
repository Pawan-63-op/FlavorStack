export abstract class DomainError extends Error {
  readonly code: string;

  public constructor(message: string, code: string) {
    super(message);

    this.name = this.constructor.name;
    this.code = code;

    Error.captureStackTrace?.(this, this.constructor);
  }
}
