import { DomainError } from './DomainError';

export class ConflictError extends DomainError {
  constructor(message: string, details?: any) {
    super(message, 'CONFLICT', details);
  }
}

