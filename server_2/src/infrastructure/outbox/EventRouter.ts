// EventRouter — maps an event name → the target BullMQ queue(s) that should
// receive it, and turns a drained outbox row into one ready-to-enqueue job per
// target (Catalog Phase 12).
//
// This is the routing half of the outbox spine: the (fulfillment-owned)
// OutboxPoller drains PENDING rows and asks the router where each event goes,
// then enqueues the returned jobs. Catalog only *writes* outbox rows and
// *declares* its routes here — it never enqueues to BullMQ directly (the outbox
// is the only async publishing mechanism).
//
// Routes are registered, not hard-coded, so every bounded context contributes its
// own event→queue map (see `registerCatalogEventRoutes`). Registering the same
// event again unions the queue set (idempotent, order-independent).
//
// Idempotency: each routed job carries `jobId = eventId`. BullMQ dedups jobs by
// id, so at-least-once outbox delivery collapses to effectively-once enqueueing,
// and downstream workers dedup on the same `eventId`.

/** The minimal projection of an outbox row the router needs to build jobs. */
export interface RoutableEvent {
  eventId: string;
  eventName: string;
  payload: Record<string, unknown>;
}

/** A single enqueue instruction: push `payload` onto `queue` with id `jobId`. */
export interface RoutedJob {
  queue: string;
  jobId: string;
  eventName: string;
  payload: Record<string, unknown>;
}

export class EventRouter {
  private readonly routes = new Map<string, Set<string>>();

  /** Declare that `eventName` should fan out to `queues`. Unions on repeat. */
  register(eventName: string, queues: readonly string[]): this {
    const set = this.routes.get(eventName) ?? new Set<string>();
    for (const q of queues) set.add(q);
    this.routes.set(eventName, set);
    return this;
  }

  /** True when at least one queue is registered for `eventName`. */
  has(eventName: string): boolean {
    return (this.routes.get(eventName)?.size ?? 0) > 0;
  }

  /** Target queues for `eventName` (empty when unrouted). */
  routesFor(eventName: string): string[] {
    return [...(this.routes.get(eventName) ?? [])];
  }

  /**
   * Build the enqueue instructions for a drained event. Unrouted events return
   * `[]` — the poller can settle them as PROCESSED without enqueueing anything
   * (a purely in-process event has no cross-context target).
   */
  route(event: RoutableEvent): RoutedJob[] {
    return this.routesFor(event.eventName).map((queue) => ({
      queue,
      jobId: event.eventId,
      eventName: event.eventName,
      payload: event.payload,
    }));
  }
}
