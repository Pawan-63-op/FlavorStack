import { SendEmailOtp } from '../../../../application/identity/use-cases/SendEmailOtp';
import { SendEmailOtpDto } from '../../../../application/identity/dtos/SendEmailOtpDto';
import { emailVerificationOtpKey } from '../../../../application/identity/otp-keys';
import {
  InMemoryUserRepository,
  InMemoryOtpStore,
  FakeOtpGenerator,
  FakeEmailProvider,
} from '../../../mocks/identity.mocks';
import { Customer } from '../../../../domain/identity/entities/Customer';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';

const FIXED_OTP = '424242';

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

describe('SendEmailOtp use-case', () => {
  let userRepo: InMemoryUserRepository;
  let otpGenerator: FakeOtpGenerator;
  let otpStore: InMemoryOtpStore;
  let emailProvider: FakeEmailProvider;
  let useCase: SendEmailOtp;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    otpGenerator = new FakeOtpGenerator(FIXED_OTP);
    otpStore = new InMemoryOtpStore();
    emailProvider = new FakeEmailProvider();
    useCase = new SendEmailOtp(userRepo, otpGenerator, otpStore, emailProvider);
  });

  describe('success', () => {
    it('issues an email-verification OTP and sends it via email', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);

      const dto: SendEmailOtpDto = { userId: customer._id };
      const result = await useCase.execute(dto);

      expect(result.isSuccess).toBe(true);

      const otpResult = await otpStore.verify(emailVerificationOtpKey(customer._id), FIXED_OTP);
      expect(otpResult.isSuccess).toBe(true);

      expect(emailProvider.sent).toHaveLength(1);
      expect(emailProvider.sent[0].type).toBe('verification');
      expect(emailProvider.sent[0].to).toBe(customer.email);
      expect(emailProvider.sent[0].payload).toEqual({ token: FIXED_OTP });
    });
  });

  describe('failure paths', () => {
    it('fails with NotFoundError for unknown user', async () => {
      const result = await useCase.execute({ userId: 'does-not-exist' });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(NotFoundError);
      expect(emailProvider.sent).toHaveLength(0);
    });
  });
});
