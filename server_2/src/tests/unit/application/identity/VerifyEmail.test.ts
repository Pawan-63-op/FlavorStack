import { VerifyEmail } from '../../../../application/identity/use-cases/VerifyEmail';
import { VerifyEmailDto } from '../../../../application/identity/dtos/VerifyEmailDto';
import { emailVerificationOtpKey } from '../../../../application/identity/otp-keys';
import {
  InMemoryUserRepository,
  InMemoryUnitOfWork,
  InMemoryOtpStore,
} from '../../../mocks/identity.mocks';
import { createEventBusSpy, EventBusSpy } from '../../../mocks/shared.mocks';
import { Customer } from '../../../../domain/identity/entities/Customer';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ConflictError } from '../../../../domain/shared/errors/ConflictError';
import { DomainError } from '../../../../domain/shared/errors/DomainError';

const VALID_CODE = '123456';

function makeCustomer(email = 'user@example.com'): Customer {
  const customer = Customer.create({
    name: 'Test User',
    email,
    phone: '+919876543210',
    passwordHash: 'hashed:Password1!',
    referralCode: 'REF00001',
  });
  customer.pullDomainEvents();
  return customer;
}

describe('VerifyEmail use-case', () => {
  let userRepo: InMemoryUserRepository;
  let otpStore: InMemoryOtpStore;
  let unitOfWork: InMemoryUnitOfWork;
  let eventBus: EventBusSpy;
  let useCase: VerifyEmail;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    otpStore = new InMemoryOtpStore();
    unitOfWork = new InMemoryUnitOfWork();
    eventBus = createEventBusSpy();
    useCase = new VerifyEmail(userRepo, otpStore, unitOfWork, eventBus);
  });

  describe('success', () => {
    it('marks the user verified and returns UserResponse', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);
      await otpStore.issue(emailVerificationOtpKey(customer._id), VALID_CODE, 900);

      const dto: VerifyEmailDto = { email: customer.email, code: VALID_CODE };
      const result = await useCase.execute(dto);

      expect(result.isSuccess).toBe(true);
      const response = result.getValue();
      expect(response.isEmailVerified).toBe(true);
      expect(response.id).toBe(customer._id);

      const updated = await userRepo.findById(customer._id);
      expect(updated!.isEmailVerified).toBe(true);
    });

    it('raises no domain event, so nothing is published', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);
      await otpStore.issue(emailVerificationOtpKey(customer._id), VALID_CODE, 900);

      await useCase.execute({ email: customer.email, code: VALID_CODE });

      // Phase 6: this state change raises no domain event — it had no subscriber.
      expect(eventBus.publishedEvents).toHaveLength(0);
      expect(eventBus.publishedEvents).toHaveLength(0);
    });

    it('consumes the OTP so it cannot be reused', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);
      await otpStore.issue(emailVerificationOtpKey(customer._id), VALID_CODE, 900);

      await useCase.execute({ email: customer.email, code: VALID_CODE });

      const second = await otpStore.verify(emailVerificationOtpKey(customer._id), VALID_CODE);
      expect(second.isFailure).toBe(true);
    });
  });

  describe('failure paths', () => {
    it('fails with validation error on malformed email', async () => {
      const result = await useCase.execute({ email: 'not-an-email', code: VALID_CODE });
      expect(result.isFailure).toBe(true);
    });

    it('fails with NotFoundError for unknown email', async () => {
      const result = await useCase.execute({ email: 'nobody@example.com', code: VALID_CODE });
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(NotFoundError);
    });

    it('fails when the OTP code is wrong and does not modify the user', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);
      await otpStore.issue(emailVerificationOtpKey(customer._id), VALID_CODE, 900);

      const result = await useCase.execute({ email: customer.email, code: 'wrong' });

      expect(result.isFailure).toBe(true);
      const updated = await userRepo.findById(customer._id);
      expect(updated!.isEmailVerified).toBe(false);
      expect(eventBus.publishedEvents).toHaveLength(0);
      expect(eventBus.publishedEvents).toHaveLength(0);
    });

    it('fails with ConflictError if the user is already verified', async () => {
      const customer = makeCustomer();
      customer.verifyEmail();
      customer.pullDomainEvents();
      await userRepo.save(customer);
      await otpStore.issue(emailVerificationOtpKey(customer._id), VALID_CODE, 900);

      const result = await useCase.execute({ email: customer.email, code: VALID_CODE });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ConflictError);
      const err = result.getError() as DomainError;
      expect(err.message).toBe('email_already_verified');
    });
  });
});
