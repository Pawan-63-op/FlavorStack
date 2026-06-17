const mockInfo = jest.fn();

jest.mock('../../../../infrastructure/observability/logger', () => ({
  logger: { info: (...args: unknown[]) => mockInfo(...args) },
}));

import { LoggerSmsProvider } from '../../../../infrastructure/external/sms/LoggerSmsProvider';
import { PhoneNumber } from '../../../../domain/identity/value-objects/PhoneNumber.vo';

describe('LoggerSmsProvider', () => {
  let phone: PhoneNumber;

  beforeEach(() => {
    mockInfo.mockClear();
    phone = PhoneNumber.create('+14155552671').getValue();
  });

  describe('sendOtp', () => {
    it('logs an sms.otp.sent event with the phone number', async () => {
      const provider = new LoggerSmsProvider();

      await provider.sendOtp(phone, '123456');

      expect(mockInfo).toHaveBeenCalledTimes(1);
      const payload = mockInfo.mock.calls[0][0];
      expect(payload).toEqual({ event: 'sms.otp.sent', phone: phone.value });
    });

    it('never logs the OTP code', async () => {
      const provider = new LoggerSmsProvider();

      await provider.sendOtp(phone, 'SECRET-CODE-999');

      const allLoggedArgs = mockInfo.mock.calls.flat();
      for (const arg of allLoggedArgs) {
        expect(JSON.stringify(arg)).not.toContain('SECRET-CODE-999');
      }
    });
  });
});
