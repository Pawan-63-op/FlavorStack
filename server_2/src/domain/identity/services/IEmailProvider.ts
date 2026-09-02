import { Email } from '../value-objects/Email.vo';

export interface IEmailProvider {
  sendVerification(to: Email, token: string): Promise<void>;
  sendNotification(to: Email, subject: string, body: string): Promise<void>;
}
