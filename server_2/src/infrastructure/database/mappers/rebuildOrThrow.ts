import { Result } from '../../../domain/shared/Result';
import { DomainError } from '../../../domain/shared/errors/DomainError';

export function rebuildOrThrow<T>(result: Result<T>, context: string): T {
  if (result.isFailure) {
    throw new DomainError(
      `Failed to rebuild ${context} from persisted data: ${String(result.getError())}`,
      'PERSISTENCE_MAPPING_ERROR'
    );
  }
  return result.getValue();
}
