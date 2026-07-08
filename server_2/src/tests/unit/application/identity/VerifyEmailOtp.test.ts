import { VerifyEmailOtp } from '../../../../application/identity/use-cases/VerifyEmailOtp';
import { emailVerificationOtpKey } from '../../../../application/identity/otp-keys';
import { InMemoryOtpStore } from '../../../mocks/identity.mocks';

const USER_ID = 'user-1';
const VALID_CODE = '111222';

describe('VerifyEmailOtp use-case', () => {
  let otpStore: InMemoryOtpStore;
  let useCase: VerifyEmailOtp;

  beforeEach(() => {
    otpStore = new InMemoryOtpStore();
    useCase = new VerifyEmailOtp(otpStore);
  });

  describe('success', () => {
    it('returns ack for a valid code without consuming it', async () => {
      await otpStore.issue(emailVerificationOtpKey(USER_ID), VALID_CODE, 900);

      const result = await useCase.execute({ userId: USER_ID, code: VALID_CODE });

      expect(result.isSuccess).toBe(true);

      const second = await otpStore.verify(emailVerificationOtpKey(USER_ID), VALID_CODE);
      expect(second.isSuccess).toBe(true);
    });
  });

  describe('failure paths', () => {
    it('fails for a wrong code', async () => {
      await otpStore.issue(emailVerificationOtpKey(USER_ID), VALID_CODE, 900);

      const result = await useCase.execute({ userId: USER_ID, code: 'wrong' });

      expect(result.isFailure).toBe(true);
    });

    it('fails when no OTP was issued', async () => {
      const result = await useCase.execute({ userId: USER_ID, code: VALID_CODE });

      expect(result.isFailure).toBe(true);
    });
  });
});
