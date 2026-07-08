import { Login } from '../../../../application/identity/use-cases/Login';
import { RefreshToken } from '../../../../application/identity/use-cases/RefreshToken';
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
import { DomainError } from '../../../../domain/shared/errors/DomainError';
import { Result } from '../../../../domain/shared/Result';

const PLAIN_PASSWORD = 'Password1!';

function makeCustomer(email = 'user@example.com'): Customer {
  const c = Customer.create({
    name: 'Test User',
    email,
    phone: '+919876543210',
    passwordHash: `hashed:${PLAIN_PASSWORD}`,
    referralCode: 'REF00001',
  });
  c.pullDomainEvents();
  return c;
}

describe('RefreshToken use-case', () => {
  let userRepo: InMemoryUserRepository;
  let passwordHasher: FakePasswordHasher;
  let tokenService: FakeTokenService;
  let refreshTokenHasher: FakeRefreshTokenHasher;
  let sessionStore: InMemorySessionStore;
  let loginUseCase: Login;
  let refreshUseCase: RefreshToken;

  const loginDto: LoginDto = {
    email: 'user@example.com',
    password: PLAIN_PASSWORD,
  };

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    passwordHasher = new FakePasswordHasher();
    tokenService = new FakeTokenService();
    refreshTokenHasher = new FakeRefreshTokenHasher();
    sessionStore = new InMemorySessionStore();
    loginUseCase = new Login(userRepo, passwordHasher, tokenService, sessionStore, refreshTokenHasher);
    refreshUseCase = new RefreshToken(userRepo, tokenService, sessionStore, refreshTokenHasher);
  });

  async function loginAndGetToken(): Promise<string> {
    const customer = makeCustomer();
    await userRepo.save(customer);
    const result = await loginUseCase.execute(loginDto);
    return result.getValue().refreshToken;
  }

  describe('success', () => {
    it('returns new access and refresh tokens', async () => {
      const refreshToken = await loginAndGetToken();
      const result = await refreshUseCase.execute({ refreshToken });
      expect(result.isSuccess).toBe(true);
      const auth = result.getValue();
      expect(auth.accessToken).toBeTruthy();
      expect(auth.refreshToken).toBeTruthy();
      expect(auth.expiresIn).toBe(900);
    });

    it('old session is invalidated after rotation', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);
      const loginResult = await loginUseCase.execute(loginDto);
      const refreshToken = loginResult.getValue().refreshToken;

      await refreshUseCase.execute({ refreshToken });

      const oldPayload = tokenService.decode(refreshToken);
      const oldSession = await sessionStore.find(customer._id, oldPayload!.sessionId);
      expect(oldSession).toBeNull();
    });

    it('new session is persisted after rotation', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);
      const loginResult = await loginUseCase.execute(loginDto);
      const refreshToken = loginResult.getValue().refreshToken;

      const result = await refreshUseCase.execute({ refreshToken });
      const newToken = result.getValue().refreshToken;
      const newPayload = tokenService.decode(newToken);
      const newSession = await sessionStore.find(customer._id, newPayload!.sessionId);
      expect(newSession).not.toBeNull();
    });
  });

  describe('failure paths', () => {
    it('fails with ForbiddenError on invalid token signature', async () => {
      tokenService.setVerifyResult(Result.fail('invalid'));
      const result = await refreshUseCase.execute({ refreshToken: 'bad.token.here' });
      expect(result.isFailure).toBe(true);
      const err = result.getError() as DomainError;
      expect(err).toBeInstanceOf(ForbiddenError);
      expect(err.message).toBe('invalid_token');
    });

    it('fails with ForbiddenError when session not found', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);
      const loginResult = await loginUseCase.execute(loginDto);
      const refreshToken = loginResult.getValue().refreshToken;

      const payload = tokenService.decode(refreshToken);
      await sessionStore.invalidate(customer._id, payload!.sessionId);

      const result = await refreshUseCase.execute({ refreshToken });
      expect(result.isFailure).toBe(true);
      const err = result.getError() as DomainError;
      expect(err).toBeInstanceOf(ForbiddenError);
      expect(err.message).toBe('session_not_found');
    });

    it('detects token reuse — wrong hash invalidates all sessions', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);
      const loginResult = await loginUseCase.execute(loginDto);
      const refreshToken = loginResult.getValue().refreshToken;

      const payload = tokenService.decode(refreshToken);
      const session = await sessionStore.find(customer._id, payload!.sessionId);
      sessionStore.sessions.set(`${customer._id}:${session!.sessionId}`, {
        ...session!,
        refreshTokenHash: refreshTokenHasher.hash('some_old_superseded_token'),
      });

      const result = await refreshUseCase.execute({ refreshToken });
      expect(result.isFailure).toBe(true);
      const err = result.getError() as DomainError;
      expect(err).toBeInstanceOf(ForbiddenError);
      expect(err.message).toBe('token_reuse_detected');

      const sessions = await sessionStore.list(customer._id);
      expect(sessions.length).toBe(0);
    });

    it('fails with ForbiddenError when user is inactive', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);
      const loginResult = await loginUseCase.execute(loginDto);
      const refreshToken = loginResult.getValue().refreshToken;

      customer.softDelete();

      const result = await refreshUseCase.execute({ refreshToken });
      expect(result.isFailure).toBe(true);
      const err = result.getError() as DomainError;
      expect(err).toBeInstanceOf(ForbiddenError);
    });

    it('fails with ForbiddenError when token tokenVersion is stale', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);
      const loginResult = await loginUseCase.execute(loginDto);
      const refreshToken = loginResult.getValue().refreshToken;

      customer.tokenVersion += 1;

      const result = await refreshUseCase.execute({ refreshToken });
      expect(result.isFailure).toBe(true);
      const err = result.getError() as DomainError;
      expect(err).toBeInstanceOf(ForbiddenError);
      expect(err.message).toBe('token_version_mismatch');
    });
  });
});
