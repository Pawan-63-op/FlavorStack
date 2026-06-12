import { Resend } from 'resend';
import { IEmailProvider } from '../../../domain/identity/services/IEmailProvider';
import { Email } from '../../../domain/identity/value-objects/Email.vo';
import { EmailConfig } from '../../../config/email';
import { logger } from '../../observability/logger';

/** Wraps the Resend SDK. Provider errors are thrown so callers (outbox/worker) can retry. */
export class ResendEmailProvider implements IEmailProvider {
  private readonly client: Resend;

  constructor(private readonly config: EmailConfig) {
    this.client = new Resend(config.apiKey);
  }

  async sendVerification(to: Email, token: string): Promise<void> {
    const url = `${this.config.appBaseUrl}/verify-email?token=${token}`;
    await this.send(
      to,
      'Verify your email',
      `<p>Welcome to FlavorStack! Please verify your email by clicking the link below.</p><p><a href="${url}">${url}</a></p>`,
      `Welcome to FlavorStack! Verify your email: ${url}`,
    );
  }

  async sendPasswordReset(to: Email, token: string): Promise<void> {
    const url = `${this.config.appBaseUrl}/reset-password?token=${token}`;
    await this.send(
      to,
      'Reset your password',
      `<p>We received a request to reset your password. Click the link below to choose a new one.</p><p><a href="${url}">${url}</a></p>`,
      `Reset your password: ${url}`,
    );
  }

  async sendNotification(to: Email, subject: string, body: string): Promise<void> {
    await this.send(to, subject, body, body);
  }

  private async send(to: Email, subject: string, html: string, text: string): Promise<void> {
    const { data, error } = await this.client.emails.send({
      from: this.config.from,
      to: to.value,
      subject,
      html,
      text,
    });

    if (error) {
      logger.error({ err: error, to: to.value, subject }, 'Failed to send email via Resend');
      throw new Error(`Failed to send email: ${error.message}`);
    }

    logger.info({ id: data?.id, to: to.value, subject }, 'Email sent via Resend');
  }
}
