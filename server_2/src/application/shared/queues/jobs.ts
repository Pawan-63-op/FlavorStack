/**
 * Email is a dumb transport as of Phase 5 Batch 3: copy is rendered from `notification_templates`
 * in the API process (`IEmailComposer`) and the worker only ships `subject` + `body`.
 */
export type EmailJob = { type: 'notification'; to: string; subject: string; body: string };

export interface EnqueueOptions {
  jobId?: string;
}
