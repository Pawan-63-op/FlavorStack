import { SendPhoneOtp } from '../../../../application/identity/use-cases/SendPhoneOtp';
import { SendPhoneOtpDto } from '../../../../application/identity/dtos/SendPhoneOtpDto';
import { phoneVerificationOtpKey } from '../../../../application/identity/otp-keys';
import {
  InMemoryUserRepository,
  InMemoryOtpStore,
  FakeOtpGenerator,
  FakeSmsProvider,
} from '../../../mocks/identity.mocks';
import { Customer } from '../../../../domain/identity/entities/Customer';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';

const FIXED_OTP = '777888';
const VALID_PHONE = '+919876543210';

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

describe('SendPhoneOtp use-case', () => {
  let userRepo: InMemoryUserRepository;
  let otpGenerator: FakeOtpGenerator;
  let otpStore: InMemoryOtpStore;
  let smsProvider: FakeSmsProvider;
  let useCase: SendPhoneOtp;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    otpGenerator = new FakeOtpGenerator(FIXED_OTP);
    otpStore = new InMemoryOtpStore();
    smsProvider = new FakeSmsProvider();
    useCase = new SendPhoneOtp(userRepo, otpGenerator, otpStore, smsProvider);
  });

  describe('success', () => {
    it('issues a phone-verification OTP and sends it via SMS', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);

      const dto: SendPhoneOtpDto = { userId: customer._id, phone: VALID_PHONE };
      const result = await useCase.execute(dto);

      expect(result.isSuccess).toBe(true);

      const otpResult = await otpStore.verify(phoneVerificationOtpKey(customer._id), FIXED_OTP);
      expect(otpResult.isSuccess).toBe(true);

      expect(smsProvider.sent).toHaveLength(1);
      expect(smsProvider.sent[0]).toEqual({ phone: VALID_PHONE, code: FIXED_OTP });
    });
  });

  describe('failure paths', () => {
    it('fails with validation error for an invalid phone number', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);

      const result = await useCase.execute({ userId: customer._id, phone: 'not-a-phone' });

      expect(result.isFailure).toBe(true);
      expect(smsProvider.sent).toHaveLength(0);
    });

    it('fails with NotFoundError for unknown user', async () => {
      const result = await useCase.execute({ userId: 'does-not-exist', phone: VALID_PHONE });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(NotFoundError);
      expect(smsProvider.sent).toHaveLength(0);
    });
  });
});
