import { Login } from '../../../../application/identity/use-cases/Login';
import { LoginDto } from '../../../../application/identity/dtos/LoginDto';
import {
  InMemoryUserRepository,
  FakePasswordHasher,
  FakeTokenService,
  FakeRefreshTokenHasher,
  InMemorySessionStore,
} from '../../../mocks/identity.mocks';
import { Customer } from '../../../../domain/identity/entities/Customer';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { DomainError } from '../../../../domain/shared/errors/DomainError';

const PLAIN_PASSWORD = 'Password1!';

function makeCustomer(email = 'user@example.com', passwordHash?: string): Customer {
  return Customer.create({
    name: 'Test User',
    email,
    phone: '+919876543210',
    passwordHash: passwordHash ?? `hashed:${PLAIN_PASSWORD}`,
    referralCode: 'REF00001',
  });
}

describe('Login use-case', () => {
  let userRepo: InMemoryUserRepository;
  let passwordHasher: FakePasswordHasher;
  let tokenService: FakeTokenService;
  let refreshTokenHasher: FakeRefreshTokenHasher;
  let sessionStore: InMemorySessionStore;
  let useCase: Login;

  const dto: LoginDto = {
    email: 'user@example.com',
    password: PLAIN_PASSWORD,
    device: 'iPhone 14',
    ip: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
  };

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    passwordHasher = new FakePasswordHasher();
    tokenService = new FakeTokenService();
    refreshTokenHasher = new FakeRefreshTokenHasher();
    sessionStore = new InMemorySessionStore();
    useCase = new Login(userRepo, passwordHasher, tokenService, sessionStore, refreshTokenHasher);
  });

  describe('success', () => {
    it('returns access and refresh tokens on valid credentials', async () => {
      const customer = makeCustomer();
      customer.pullDomainEvents();
      await userRepo.save(customer);

      const result = await useCase.execute(dto);
      expect(result.isSuccess).toBe(true);
      const auth = result.getValue();
      expect(auth.accessToken).toBeTruthy();
      expect(auth.refreshToken).toBeTruthy();
      expect(auth.expiresIn).toBe(900);
    });

    it('persists a session in the session store', async () => {
      const customer = makeCustomer();
      customer.pullDomainEvents();
      await userRepo.save(customer);

      const result = await useCase.execute(dto);
      expect(result.isSuccess).toBe(true);
      const sessions = await sessionStore.list(customer._id);
      expect(sessions.length).toBe(1);
      expect(sessions[0].ipAddress).toBe('127.0.0.1');
    });

    it('stores hashed refresh token (not raw) in session', async () => {
      const customer = makeCustomer();
      customer.pullDomainEvents();
      await userRepo.save(customer);

      const result = await useCase.execute(dto);
      const auth = result.getValue();
      const sessions = await sessionStore.list(customer._id);
      const session = sessions[0];
      expect(session.refreshTokenHash).not.toBe(auth.refreshToken);
      expect(session.refreshTokenHash).toBe(refreshTokenHasher.hash(auth.refreshToken));
    });

    it('resets loginAttempts and records lastLoginIp after success', async () => {
      const customer = makeCustomer();
      customer.loginAttempts = 2;
      customer.pullDomainEvents();
      await userRepo.save(customer);

      await useCase.execute(dto);
      const updated = await userRepo.findById(customer._id);
      expect(updated!.loginAttempts).toBe(0);
      expect(updated!.lastLoginIp).toBe('127.0.0.1');
    });
  });

  describe('failure paths', () => {
    it('fails with NotFoundError for unknown email (no enumeration)', async () => {
      const result = await useCase.execute(dto);
      expect(result.isFailure).toBe(true);
      const err = result.getError() as DomainError;
      expect(err).toBeInstanceOf(NotFoundError);
      expect(err.message).toBe('invalid_credentials');
    });

    it('fails with validation error on malformed email', async () => {
      const result = await useCase.execute({ ...dto, email: 'not-an-email' });
      expect(result.isFailure).toBe(true);
    });

    it('fails with ForbiddenError on wrong password', async () => {
      const customer = makeCustomer();
      customer.pullDomainEvents();
      await userRepo.save(customer);

      const result = await useCase.execute({ ...dto, password: 'WrongPass1!' });
      expect(result.isFailure).toBe(true);
      const err = result.getError() as DomainError;
      expect(err).toBeInstanceOf(ForbiddenError);
      expect(err.message).toBe('invalid_credentials');
    });

    it('increments loginAttempts on each wrong password', async () => {
      const customer = makeCustomer();
      customer.pullDomainEvents();
      await userRepo.save(customer);

      await useCase.execute({ ...dto, password: 'WrongPass1!' });
      const updated = await userRepo.findById(customer._id);
      expect(updated!.loginAttempts).toBe(1);
    });

    it('locks account after 5 failed attempts', async () => {
      const customer = makeCustomer();
      customer.pullDomainEvents();
      await userRepo.save(customer);

      for (let i = 0; i < 5; i++) {
        await useCase.execute({ ...dto, password: 'WrongPass1!' });
      }

      const updated = await userRepo.findById(customer._id);
      expect(updated!.isLocked).toBe(true);
    });

    it('returns account_locked_or_banned after account is locked', async () => {
      const customer = makeCustomer();
      customer.lockAccount();
      customer.pullDomainEvents();
      await userRepo.save(customer);

      const result = await useCase.execute(dto);
      expect(result.isFailure).toBe(true);
      const err = result.getError() as DomainError;
      expect(err).toBeInstanceOf(ForbiddenError);
      expect(err.message).toBe('account_locked_or_banned');
    });

    it('returns account_locked_or_banned for banned user', async () => {
      const customer = makeCustomer();
      customer.ban('spam');
      customer.pullDomainEvents();
      await userRepo.save(customer);

      const result = await useCase.execute(dto);
      expect(result.isFailure).toBe(true);
      const err = result.getError() as DomainError;
      expect(err).toBeInstanceOf(ForbiddenError);
      expect(err.message).toBe('account_locked_or_banned');
    });
  });

  describe('lockout scenario', () => {
    it('6th attempt returns locked error after 5 consecutive failures', async () => {
      const customer = makeCustomer();
      customer.pullDomainEvents();
      await userRepo.save(customer);

      for (let i = 0; i < 5; i++) {
        await useCase.execute({ ...dto, password: 'WrongPass1!' });
      }

      const result = await useCase.execute(dto);
      expect(result.isFailure).toBe(true);
      const err = result.getError() as DomainError;
      expect(err).toBeInstanceOf(ForbiddenError);
      expect(err.message).toBe('account_locked_or_banned');
    });
  });
});
