export interface AssignmentTimeoutJob {
  type: 'assignment-timeout';
  fulfillmentId: string;
  attempt: number;
}

export interface SlaTimeoutJob {
  type: 'sla-timeout';
  fulfillmentId: string;
  stage: string;
}

export type FulfillmentJob = AssignmentTimeoutJob | SlaTimeoutJob;

export interface ScheduleOptions {
  jobId: string;
  delayMs: number;
}

export interface IFulfillmentJobScheduler {
  schedule(job: FulfillmentJob, opts: ScheduleOptions): Promise<void>;
  close(): Promise<void>;
}
