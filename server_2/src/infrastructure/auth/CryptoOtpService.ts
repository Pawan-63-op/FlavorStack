import { randomInt } from 'crypto';
import { IOtpGenerator } from '../../domain/identity/services/IOtpGenerator';

const DEFAULT_OTP_LENGTH = 6;

export class CryptoOtpService implements IOtpGenerator {
  generate(length: number = DEFAULT_OTP_LENGTH): string {
    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += randomInt(0, 10).toString();
    }
    return otp;
  }
}
