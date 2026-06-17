import { ForgotPassword } from '../../../../application/identity/use-cases/ForgotPassword';
import { ForgotPasswordDto } from '../../../../application/identity/dtos/ForgotPasswordDto';
import { passwordResetOtpKey } from '../../../../application/identity/otp-keys';
import {
  InMemoryUserRepository,
  InMemoryOutboxStore,
  InMemoryUnitOfWork,
  InMemoryOtpStore,
  FakeOtpGenerator,
} from '../../../mocks/identity.mocks';
import { createEventBusSpy, EventBusSpy } from '../../../mocks/shared.mocks';
import { Customer } from '../../../../domain/identity/entities/Customer';

const FIXED_OTP = '999999';

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

describe('ForgotPassword use-case', () => {
  let userRepo: InMemoryUserRepository;
  let otpGenerator: FakeOtpGenerator;
  let otpStore: InMemoryOtpStore;
  let unitOfWork: InMemoryUnitOfWork;
  let outboxStore: InMemoryOutboxStore;
  let eventBus: EventBusSpy;
  let useCase: ForgotPassword;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    otpGenerator = new FakeOtpGenerator(FIXED_OTP);
    otpStore = new InMemoryOtpStore();
    unitOfWork = new InMemoryUnitOfWork();
    outboxStore = new InMemoryOutboxStore();
    eventBus = createEventBusSpy();
    useCase = new ForgotPassword(userRepo, otpGenerator, otpStore, unitOfWork, outboxStore, eventBus);
  });

  describe('success — known account', () => {
    it('returns ack and issues a reset OTP', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);

      const dto: ForgotPasswordDto = { email: customer.email };
      const result = await useCase.execute(dto);

      expect(result.isSuccess).toBe(true);

      const otpResult = await otpStore.verify(passwordResetOtpKey(customer._id), FIXED_OTP);
      expect(otpResult.isSuccess).toBe(true);
    });

    it('appends PasswordResetRequested to the outbox and publishes it post-commit', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);

      await useCase.execute({ email: customer.email });

      expect(outboxStore.appended).toHaveLength(1);
      expect(outboxStore.appended[0].eventName).toBe('PasswordResetRequested');
      expect(outboxStore.appended[0].aggregateId).toBe(customer._id);

      expect(eventBus.publishedEvents).toHaveLength(1);
      expect(eventBus.publishedEvents[0].eventName).toBe('PasswordResetRequested');
    });
  });

  describe('unknown account — no enumeration', () => {
    it('returns ack without issuing an OTP or raising events', async () => {
      const result = await useCase.execute({ email: 'nobody@example.com' });

      expect(result.isSuccess).toBe(true);
      expect(outboxStore.appended).toHaveLength(0);
      expect(eventBus.publishedEvents).toHaveLength(0);
    });
  });

  describe('failure paths', () => {
    it('fails with validation error on malformed email', async () => {
      const result = await useCase.execute({ email: 'not-an-email' });
      expect(result.isFailure).toBe(true);
    });
  });
});
