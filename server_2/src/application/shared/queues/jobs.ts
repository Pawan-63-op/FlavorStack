export type EmailJob =
  | { type: 'welcome'; to: string; name: string }
  | { type: 'password-reset'; to: string }
  | { type: 'verification'; to: string; token: string }
  | { type: 'notification'; to: string; subject: string; body: string };

export interface EnqueueOptions {
  jobId?: string;
}

export type NotificationJob =
  | {
      type: 'push';
      token: string;
      title: string;
      body: string;
      data?: Record<string, string>;
    }
  // Engagement dispatch job: carries the persisted Notification id + channel so the worker
  // (Phase 4) loads the row and routes it through the channel abstraction, then marks SENT/FAILED.
  | {
      type: 'engagement';
      notificationId: string;
      channel: 'PUSH' | 'EMAIL';
    };
