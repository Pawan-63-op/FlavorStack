import { ChangePassword } from '../../../../application/identity/use-cases/ChangePassword';
import { ChangePasswordDto } from '../../../../application/identity/dtos/ChangePasswordDto';
import {
  InMemoryUserRepository,
  InMemoryUnitOfWork,
  InMemorySessionStore,
  FakePasswordHasher,
} from '../../../mocks/identity.mocks';
import { createEventBusSpy, EventBusSpy } from '../../../mocks/shared.mocks';
import { Customer } from '../../../../domain/identity/entities/Customer';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';

const CURRENT_PASSWORD = 'Password1!';
const NEW_PASSWORD = 'NewPassword2@';

function makeCustomer(): Customer {
  const customer = Customer.create({
    name: 'Test User',
    email: 'user@example.com',
    phone: '+919876543210',
    passwordHash: `hashed:${CURRENT_PASSWORD}`,
    referralCode: 'REF00001',
  });
  customer.pullDomainEvents();
  return customer;
}

describe('ChangePassword use-case', () => {
  let userRepo: InMemoryUserRepository;
  let passwordHasher: FakePasswordHasher;
  let sessionStore: InMemorySessionStore;
  let unitOfWork: InMemoryUnitOfWork;
  let eventBus: EventBusSpy;
  let useCase: ChangePassword;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    passwordHasher = new FakePasswordHasher();
    sessionStore = new InMemorySessionStore();
    unitOfWork = new InMemoryUnitOfWork();
    eventBus = createEventBusSpy();
    useCase = new ChangePassword(userRepo, passwordHasher, sessionStore, unitOfWork, eventBus);
  });

  describe('success', () => {
    it('updates the password hash', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);

      const dto: ChangePasswordDto = {
        userId: customer._id,
        currentPassword: CURRENT_PASSWORD,
        newPassword: NEW_PASSWORD,
      };
      const result = await useCase.execute(dto);

      expect(result.isSuccess).toBe(true);
      const updated = await userRepo.findById(customer._id);
      expect(updated!.passwordHash).toBe(`hashed:${NEW_PASSWORD}`);
    });

    it('bumps tokenVersion and invalidates all sessions', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);
      await sessionStore.persist({
        userId: customer._id,
        sessionId: 'session-1',
        refreshTokenHash: 'hash',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 1000),
      });
      const initialTokenVersion = customer.tokenVersion;

      await useCase.execute({
        userId: customer._id,
        currentPassword: CURRENT_PASSWORD,
        newPassword: NEW_PASSWORD,
      });

      const updated = await userRepo.findById(customer._id);
      expect(updated!.tokenVersion).toBe(initialTokenVersion + 1);

      const sessions = await sessionStore.list(customer._id);
      expect(sessions).toHaveLength(0);
    });

    it('publishes PasswordChanged post-commit', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);

      await useCase.execute({
        userId: customer._id,
        currentPassword: CURRENT_PASSWORD,
        newPassword: NEW_PASSWORD,
      });

      expect(eventBus.publishedEvents).toHaveLength(1);
      expect(eventBus.publishedEvents[0].eventName).toBe('PasswordChanged');
      expect(eventBus.publishedEvents[0].aggregateId).toBe(customer._id);

      expect(eventBus.publishedEvents).toHaveLength(1);
      expect(eventBus.publishedEvents[0].eventName).toBe('PasswordChanged');
    });
  });

  describe('failure paths', () => {
    it('fails with NotFoundError for unknown user', async () => {
      const result = await useCase.execute({
        userId: 'does-not-exist',
        currentPassword: CURRENT_PASSWORD,
        newPassword: NEW_PASSWORD,
      });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(NotFoundError);
    });

    it('fails with ForbiddenError when current password is wrong', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);

      const result = await useCase.execute({
        userId: customer._id,
        currentPassword: 'WrongPassword1!',
        newPassword: NEW_PASSWORD,
      });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ForbiddenError);

      const updated = await userRepo.findById(customer._id);
      expect(updated!.passwordHash).toBe(`hashed:${CURRENT_PASSWORD}`);
      expect(eventBus.publishedEvents).toHaveLength(0);
      expect(eventBus.publishedEvents).toHaveLength(0);
    });

    it('fails with validation error when new password is weak', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);

      const result = await useCase.execute({
        userId: customer._id,
        currentPassword: CURRENT_PASSWORD,
        newPassword: 'weak',
      });

      expect(result.isFailure).toBe(true);
      const updated = await userRepo.findById(customer._id);
      expect(updated!.passwordHash).toBe(`hashed:${CURRENT_PASSWORD}`);
    });
  });
});
