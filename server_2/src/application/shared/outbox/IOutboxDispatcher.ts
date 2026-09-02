import { DomainEvent } from '../../../domain/shared/DomainEvent';

/**
 * Where the outbox relay delivers a row, in place of republishing it on the
 * in-process event bus. A rejection is a real delivery failure: the relay
 * retries it with backoff and eventually marks the row FAILED.
 */
export interface IOutboxDispatcher {
  dispatch(event: DomainEvent): Promise<void>;
}
