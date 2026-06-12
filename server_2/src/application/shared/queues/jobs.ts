export type EmailJob =
  | { type: 'welcome'; to: string; name: string }
  | { type: 'password-reset'; to: string }
  | { type: 'verification'; to: string; token: string }
  | { type: 'notification'; to: string; subject: string; body: string };

export interface EnqueueOptions {
  jobId?: string;
}

export type NotificationJob = {
  type: 'push';
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
};
