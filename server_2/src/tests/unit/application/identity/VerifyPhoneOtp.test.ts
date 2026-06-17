import { VerifyPhoneOtp } from '../../../../application/identity/use-cases/VerifyPhoneOtp';
import { phoneVerificationOtpKey } from '../../../../application/identity/otp-keys';
import { InMemoryUserRepository, InMemoryOtpStore } from '../../../mocks/identity.mocks';
import { Customer } from '../../../../domain/identity/entities/Customer';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';

const VALID_CODE = '333444';

function makeCustomer(): Customer {
  const customer = Customer.create({
    name: 'Test User',
    email: 'user@example.com',
    phone: '+919876543210',
    passwordHash: 'hashed:Password1!',
    referralCode: 'REF00001',
  });
  customer.pullDomainEvents();
  return customer;
}

describe('VerifyPhoneOtp use-case', () => {
  let userRepo: InMemoryUserRepository;
  let otpStore: InMemoryOtpStore;
  let useCase: VerifyPhoneOtp;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    otpStore = new InMemoryOtpStore();
    useCase = new VerifyPhoneOtp(userRepo, otpStore);
  });

  describe('success', () => {
    it('returns ack for a valid code without consuming it', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);
      await otpStore.issue(phoneVerificationOtpKey(customer._id), VALID_CODE, 600);

      const result = await useCase.execute({ userId: customer._id, code: VALID_CODE });

      expect(result.isSuccess).toBe(true);

      const second = await otpStore.verify(phoneVerificationOtpKey(customer._id), VALID_CODE);
      expect(second.isSuccess).toBe(true);
    });
  });

  describe('failure paths', () => {
    it('fails with NotFoundError for unknown user', async () => {
      const result = await useCase.execute({ userId: 'does-not-exist', code: VALID_CODE });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(NotFoundError);
    });

    it('fails for a wrong code', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);
      await otpStore.issue(phoneVerificationOtpKey(customer._id), VALID_CODE, 600);

      const result = await useCase.execute({ userId: customer._id, code: 'wrong' });

      expect(result.isFailure).toBe(true);
    });
  });
});
