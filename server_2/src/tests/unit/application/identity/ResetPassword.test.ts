import { ResetPassword } from '../../../../application/identity/use-cases/ResetPassword';
import { ResetPasswordDto } from '../../../../application/identity/dtos/ResetPasswordDto';
import { passwordResetOtpKey } from '../../../../application/identity/otp-keys';
import {
  InMemoryUserRepository,
  InMemoryOutboxStore,
  InMemoryUnitOfWork,
  InMemorySessionStore,
  InMemoryOtpStore,
  FakePasswordHasher,
} from '../../../mocks/identity.mocks';
import { createEventBusSpy, EventBusSpy } from '../../../mocks/shared.mocks';
import { Customer } from '../../../../domain/identity/entities/Customer';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';

const VALID_CODE = '654321';
const NEW_PASSWORD = 'NewPassword2@';

function makeCustomer(): Customer {
  const customer = Customer.create({
    name: 'Test User',
    email: 'user@example.com',
    phone: '+919876543210',
    passwordHash: 'hashed:OldPassword1!',
    referralCode: 'REF00001',
  });
  customer.pullDomainEvents();
  return customer;
}

describe('ResetPassword use-case', () => {
  let userRepo: InMemoryUserRepository;
  let passwordHasher: FakePasswordHasher;
  let sessionStore: InMemorySessionStore;
  let otpStore: InMemoryOtpStore;
  let unitOfWork: InMemoryUnitOfWork;
  let outboxStore: InMemoryOutboxStore;
  let eventBus: EventBusSpy;
  let useCase: ResetPassword;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    passwordHasher = new FakePasswordHasher();
    sessionStore = new InMemorySessionStore();
    otpStore = new InMemoryOtpStore();
    unitOfWork = new InMemoryUnitOfWork();
    outboxStore = new InMemoryOutboxStore();
    eventBus = createEventBusSpy();
    useCase = new ResetPassword(userRepo, otpStore, passwordHasher, sessionStore, unitOfWork, outboxStore, eventBus);
  });

  describe('success', () => {
    it('sets the new password hash and bumps tokenVersion', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);
      await otpStore.issue(passwordResetOtpKey(customer._id), VALID_CODE, 900);
      const initialTokenVersion = customer.tokenVersion;

      const dto: ResetPasswordDto = { email: customer.email, code: VALID_CODE, newPassword: NEW_PASSWORD };
      const result = await useCase.execute(dto);

      expect(result.isSuccess).toBe(true);
      const updated = await userRepo.findById(customer._id);
      expect(updated!.passwordHash).toBe(`hashed:${NEW_PASSWORD}`);
      expect(updated!.tokenVersion).toBe(initialTokenVersion + 1);
    });

    it('invalidates all sessions', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);
      await otpStore.issue(passwordResetOtpKey(customer._id), VALID_CODE, 900);
      await sessionStore.persist({
        userId: customer._id,
        sessionId: 'session-1',
        refreshTokenHash: 'hash',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 1000),
      });

      await useCase.execute({ email: customer.email, code: VALID_CODE, newPassword: NEW_PASSWORD });

      const sessions = await sessionStore.list(customer._id);
      expect(sessions).toHaveLength(0);
    });

    it('appends PasswordResetCompleted to the outbox and publishes it post-commit', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);
      await otpStore.issue(passwordResetOtpKey(customer._id), VALID_CODE, 900);

      await useCase.execute({ email: customer.email, code: VALID_CODE, newPassword: NEW_PASSWORD });

      expect(outboxStore.appended).toHaveLength(1);
      expect(outboxStore.appended[0].eventName).toBe('PasswordResetCompleted');
      expect(outboxStore.appended[0].aggregateId).toBe(customer._id);

      expect(eventBus.publishedEvents).toHaveLength(1);
      expect(eventBus.publishedEvents[0].eventName).toBe('PasswordResetCompleted');
    });

    it('consumes the OTP so it cannot be reused', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);
      await otpStore.issue(passwordResetOtpKey(customer._id), VALID_CODE, 900);

      await useCase.execute({ email: customer.email, code: VALID_CODE, newPassword: NEW_PASSWORD });

      const second = await otpStore.verify(passwordResetOtpKey(customer._id), VALID_CODE);
      expect(second.isFailure).toBe(true);
    });
  });

  describe('failure paths', () => {
    it('fails with NotFoundError for unknown email', async () => {
      const result = await useCase.execute({ email: 'nobody@example.com', code: VALID_CODE, newPassword: NEW_PASSWORD });
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(NotFoundError);
    });

    it('fails when the OTP code is wrong and does not modify the user', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);
      await otpStore.issue(passwordResetOtpKey(customer._id), VALID_CODE, 900);

      const result = await useCase.execute({ email: customer.email, code: 'wrong', newPassword: NEW_PASSWORD });

      expect(result.isFailure).toBe(true);
      const updated = await userRepo.findById(customer._id);
      expect(updated!.passwordHash).toBe('hashed:OldPassword1!');
      expect(outboxStore.appended).toHaveLength(0);
      expect(eventBus.publishedEvents).toHaveLength(0);
    });

    it('fails with validation error when the new password is weak', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);
      await otpStore.issue(passwordResetOtpKey(customer._id), VALID_CODE, 900);

      const result = await useCase.execute({ email: customer.email, code: VALID_CODE, newPassword: 'weak' });

      expect(result.isFailure).toBe(true);
      const updated = await userRepo.findById(customer._id);
      expect(updated!.passwordHash).toBe('hashed:OldPassword1!');
    });
  });
});
