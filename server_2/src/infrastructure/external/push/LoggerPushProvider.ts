import { IPushProvider } from './IPushProvider';
import { logger } from '../../observability/logger';

/** Minimal IPushProvider that logs push attempts. Swap for FCM once device tokens exist. */
export class LoggerPushProvider implements IPushProvider {
  async sendPush(token: string, title: string, _body: string, _data?: Record<string, string>): Promise<void> {
    logger.info({ event: 'push.sent', token, title });
  }
}
