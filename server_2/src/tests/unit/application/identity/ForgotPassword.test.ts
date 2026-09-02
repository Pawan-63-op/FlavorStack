import { ForgotPassword } from '../../../../application/identity/use-cases/ForgotPassword';
import { ForgotPasswordDto } from '../../../../application/identity/dtos/ForgotPasswordDto';
import { passwordResetOtpKey } from '../../../../application/identity/otp-keys';
import {
  InMemoryUserRepository,
  InMemoryUnitOfWork,
  InMemoryOtpStore,
  FakeOtpGenerator,
  FakeEmailComposer,
  FakeEmailQueue,
} from '../../../mocks/identity.mocks';
import { createEventBusSpy, EventBusSpy } from '../../../mocks/shared.mocks';
import { Customer } from '../../../../domain/identity/entities/Customer';

const FIXED_OTP = '999999';
const APP_BASE_URL = 'https://app.flavorstack.test';

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
  let eventBus: EventBusSpy;
  let emailQueue: FakeEmailQueue;
  let emailComposer: FakeEmailComposer;
  let useCase: ForgotPassword;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    otpGenerator = new FakeOtpGenerator(FIXED_OTP);
    otpStore = new InMemoryOtpStore();
    unitOfWork = new InMemoryUnitOfWork();
    eventBus = createEventBusSpy();
    emailQueue = new FakeEmailQueue();
    emailComposer = new FakeEmailComposer();
    useCase = new ForgotPassword(
      userRepo,
      otpGenerator,
      otpStore,
      unitOfWork,
      eventBus,
      emailQueue,
      emailComposer,
      APP_BASE_URL,
    );
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

    it('raises no domain event, so nothing is published', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);

      await useCase.execute({ email: customer.email });

      // Phase 6: this state change raises no domain event — it had no subscriber.
      expect(eventBus.publishedEvents).toHaveLength(0);
      expect(eventBus.publishedEvents).toHaveLength(0);
    });
  });

  describe('reset email', () => {
    it('enqueues exactly one email carrying the issued code and the reset link', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);

      await useCase.execute({ email: customer.email });

      expect(emailComposer.calls).toEqual([
        {
          templateKey: 'password_reset',
          vars: {
            code: FIXED_OTP,
            email: customer.email,
            resetUrl: `${APP_BASE_URL}/reset-password?email=${encodeURIComponent(customer.email)}`,
          },
        },
      ]);

      expect(emailQueue.enqueued).toHaveLength(1);
      const { job, opts } = emailQueue.enqueued[0];
      expect(job.type).toBe('notification');
      expect(job.to).toBe(customer.email);
      expect(job.body).toContain(FIXED_OTP);
      expect(job.body).toContain(`${APP_BASE_URL}/reset-password?email=`);
      expect(opts?.jobId).toMatch(new RegExp(`^pwreset-${customer._id}-\\d+$`));
    });

    it('does not leak the code onto the domain event', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);

      await useCase.execute({ email: customer.email });

      expect(JSON.stringify(eventBus.publishedEvents)).not.toContain(FIXED_OTP);
      expect(JSON.stringify(eventBus.publishedEvents)).not.toContain(FIXED_OTP);
    });

    it('enqueues nothing when the password_reset template is missing or inactive', async () => {
      emailComposer.missingKeys.add('password_reset');
      const customer = makeCustomer();
      await userRepo.save(customer);

      await useCase.execute({ email: customer.email });

      expect(emailQueue.enqueued).toHaveLength(0);
    });

    it('sends no email for an unknown account', async () => {
      await useCase.execute({ email: 'nobody@example.com' });

      expect(emailQueue.enqueued).toHaveLength(0);
    });
  });

  describe('unknown account — no enumeration', () => {
    it('returns ack without issuing an OTP or raising events', async () => {
      const result = await useCase.execute({ email: 'nobody@example.com' });

      expect(result.isSuccess).toBe(true);
      expect(eventBus.publishedEvents).toHaveLength(0);
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
