import { DomainError } from './DomainError';

export class NotFoundError extends DomainError {
  constructor(message: string, details?: any) {
    super(message, 'NOT_FOUND', details);
  }
}

