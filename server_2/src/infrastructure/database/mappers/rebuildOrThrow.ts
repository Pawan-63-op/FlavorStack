// Shared rehydration guard for catalog (and other) mappers.
//
// Trusted-data policy: persisted documents are assumed valid. If a value object's
// create() fails while rebuilding from storage, that is data corruption — surface
// it as a DomainError rather than a user-facing ValidationError. Mirrors the helper
// of the same name in BaseUserMapper (kept separate to avoid coupling catalog
// mappers to the identity mapper).
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
