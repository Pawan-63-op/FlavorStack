// Delayed-job payloads + scheduler port for the Fulfillment background jobs (fulfillment_module.md
// §10, Phase 5B). The port lives in the application layer so use cases/handlers depend on the
// abstraction; the concrete BullMQ producer (FulfillmentJobQueue) is wired only in the container.
//
// Two job kinds run on QUEUE.fulfillment as BullMQ *delayed* jobs:
//   • assignment-timeout — fires at the offer's expiresAt; expires a still-OFFERED attempt then
//     re-offers the next candidate, or auto-cancels once attempts are exhausted.
//   • sla-timeout        — fires at a stage's SLA deadline; auto-cancels pre-pickup, else flags admin.
//
// Idempotency: jobId encodes the natural key so a duplicate enqueue (at-least-once) is de-duped at
// the queue, and the handler re-checks aggregate state (version/status guards) so a stale fire is a no-op.
export interface AssignmentTimeoutJob {
  type: 'assignment-timeout';
  fulfillmentId: string;
  attempt: number;
}

export interface SlaTimeoutJob {
  type: 'sla-timeout';
  fulfillmentId: string;
  // The fulfillment status that was current when this SLA timer was armed (e.g. READY_FOR_PICKUP).
  stage: string;
}

export type FulfillmentJob = AssignmentTimeoutJob | SlaTimeoutJob;

export interface ScheduleOptions {
  // Stable de-dup key; a re-enqueue with the same jobId is ignored by BullMQ.
  jobId: string;
  // Delay in milliseconds before the job becomes due.
  delayMs: number;
}

export interface IFulfillmentJobScheduler {
  schedule(job: FulfillmentJob, opts: ScheduleOptions): Promise<void>;
  close(): Promise<void>;
}
