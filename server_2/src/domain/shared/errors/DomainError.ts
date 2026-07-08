export class DomainError extends Error {
  public readonly code: string;
  public readonly details?: any;

  constructor(message: string, code = 'DOMAIN_ERROR', details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);

    if ((Error as any).captureStackTrace) {
      (Error as any).captureStackTrace(this, this.constructor);
    }
  }
}

