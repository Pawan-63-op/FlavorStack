import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { logger } from '../../../infrastructure/observability/logger';
import { IOutboxDispatcher } from './IOutboxDispatcher';

export type OutboxRoute = (event: DomainEvent) => Promise<void>;
export type OutboxRouteTable = Record<string, OutboxRoute>;

/**
 * Routes an outboxed event to exactly one handler, by name, from an explicit
 * table. Replaces the relay's old `eventBus.publish` — which fanned every row
 * out to the same in-process subscribers its use case had already published to,
 * delivering everything twice.
 *
 * An unmapped event name is not an error. Every non-routed event was already
 * delivered in-process by the use case that wrote it, so the relay treats the
 * row as a no-op and lets it settle PROCESSED — which is also what drains
 * pre-existing dev/prod backlogs.
 */
export class OutboxDispatcher implements IOutboxDispatcher {
  private readonly routes: Map<string, OutboxRoute>;
  private readonly loggedNoOps = new Set<string>();

  constructor(routes: OutboxRouteTable) {
    this.routes = new Map(Object.entries(routes));
  }

  async dispatch(event: DomainEvent): Promise<void> {
    const route = this.routes.get(event.eventName);
    if (!route) {
      this.logNoOpOnce(event.eventName);
      return;
    }
    await route(event);
  }

  /** One line per distinct event name — a backlog drain must not flood the log. */
  private logNoOpOnce(eventName: string): void {
    if (this.loggedNoOps.has(eventName)) return;
    this.loggedNoOps.add(eventName);
    logger.info(
      { eventName },
      '[OutboxDispatcher] relay no-op — delivered in-process by its use case',
    );
  }
}
