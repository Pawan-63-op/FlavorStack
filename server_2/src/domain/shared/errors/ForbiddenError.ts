import { DomainError } from './DomainError';

export class ForbiddenError extends DomainError {
  constructor(message: string, details?: any) {
    super(message, 'FORBIDDEN', details);
  }
}

