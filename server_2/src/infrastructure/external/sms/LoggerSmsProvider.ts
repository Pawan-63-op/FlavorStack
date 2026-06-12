import { ISmsProvider } from '../../../domain/identity/services/ISmsProvider';
import { PhoneNumber } from '../../../domain/identity/value-objects/PhoneNumber.vo';
import { logger } from '../../observability/logger';

/** Minimal ISmsProvider that logs OTP send attempts. Swap for a real vendor (Twilio/MSG91) later. */
export class LoggerSmsProvider implements ISmsProvider {
  async sendOtp(phone: PhoneNumber, _code: string): Promise<void> {
    logger.info({ event: 'sms.otp.sent', phone: phone.value });
  }
}
