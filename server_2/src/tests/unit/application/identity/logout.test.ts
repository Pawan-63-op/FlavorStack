import { Logout } from '../../../../application/identity/use-cases/Logout';
import { LogoutAllSessions } from '../../../../application/identity/use-cases/LogoutAllSessions';
import { GetActiveSessions } from '../../../../application/identity/use-cases/GetActiveSessions';
import {
  InMemoryUserRepository,
  InMemorySessionStore,
  InMemoryUnitOfWork,
  InMemoryOutboxStore,
} from '../../../mocks/identity.mocks';
import { createEventBusSpy } from '../../../mocks/shared.mocks';
import { Customer } from '../../../../domain/identity/entities/Customer';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { DomainError } from '../../../../domain/shared/errors/DomainError';
import { randomUUID } from 'crypto';

function makeCustomer(email = 'user@example.com'): Customer {
  const c = Customer.create({
    name: 'Test User',
    email,
    phone: '+919876543210',
    passwordHash: 'hashed:Password1!',
    referralCode: 'REF00001',
  });
  c.pullDomainEvents();
  return c;
}

async function seedSessions(
  sessionStore: InMemorySessionStore,
  userId: string,
  count = 2,
): Promise<string[]> {
  const sessionIds: string[] = [];
  for (let i = 0; i < count; i++) {
    const sessionId = randomUUID();
    sessionIds.push(sessionId);
    await sessionStore.persist({
      userId,
      sessionId,
      refreshTokenHash: `hashed:token-${i}`,
      deviceInfo: `Device ${i}`,
      ipAddress: '127.0.0.1',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
  }
  return sessionIds;
}

describe('Logout use-case', () => {
  let sessionStore: InMemorySessionStore;
  let useCase: Logout;

  beforeEach(() => {
    sessionStore = new InMemorySessionStore();
    useCase = new Logout(sessionStore);
  });

  it('removes the specific session', async () => {
    const userId = 'user-123';
    const [sessionId] = await seedSessions(sessionStore, userId, 2);

    const result = await useCase.execute({ userId, sessionId });
    expect(result.isSuccess).toBe(true);

    const sessions = await sessionStore.list(userId);
    expect(sessions.length).toBe(1);
    expect(sessions[0].sessionId).not.toBe(sessionId);
  });

  it('succeeds even if session does not exist (idempotent)', async () => {
    const result = await useCase.execute({ userId: 'nobody', sessionId: 'ghost' });
    expect(result.isSuccess).toBe(true);
  });
});

describe('LogoutAllSessions use-case', () => {
  let userRepo: InMemoryUserRepository;
  let sessionStore: InMemorySessionStore;
  let unitOfWork: InMemoryUnitOfWork;
  let outboxStore: InMemoryOutboxStore;
  let useCase: LogoutAllSessions;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    sessionStore = new InMemorySessionStore();
    unitOfWork = new InMemoryUnitOfWork();
    outboxStore = new InMemoryOutboxStore();
    const eventBus = createEventBusSpy();
    useCase = new LogoutAllSessions(userRepo, sessionStore, unitOfWork, outboxStore, eventBus);
  });

  it('invalidates all sessions for the user', async () => {
    const customer = makeCustomer();
    await userRepo.save(customer);
    await seedSessions(sessionStore, customer._id, 3);

    const result = await useCase.execute({ userId: customer._id });
    expect(result.isSuccess).toBe(true);

    const sessions = await sessionStore.list(customer._id);
    expect(sessions.length).toBe(0);
  });

  it('bumps tokenVersion on the user aggregate', async () => {
    const customer = makeCustomer();
    const initialTokenVersion = customer.tokenVersion;
    await userRepo.save(customer);

    await useCase.execute({ userId: customer._id });

    const updated = await userRepo.findById(customer._id);
    expect(updated!.tokenVersion).toBe(initialTokenVersion + 1);
  });

  it('commits the unit of work', async () => {
    const customer = makeCustomer();
    await userRepo.save(customer);

    await useCase.execute({ userId: customer._id });
    expect(unitOfWork.committed).toBe(true);
  });

  it('fails with NotFoundError when user does not exist', async () => {
    const result = await useCase.execute({ userId: 'nonexistent' });
    expect(result.isFailure).toBe(true);
    const err = result.getError() as DomainError;
    expect(err).toBeInstanceOf(NotFoundError);
    expect(err.message).toBe('user_not_found');
  });

  it('does not append events to outbox (tokenVersion bump raises no event)', async () => {
    const customer = makeCustomer();
    await userRepo.save(customer);

    await useCase.execute({ userId: customer._id });
    expect(outboxStore.appended.length).toBe(0);
  });
});

describe('GetActiveSessions use-case', () => {
  let sessionStore: InMemorySessionStore;
  let useCase: GetActiveSessions;

  beforeEach(() => {
    sessionStore = new InMemorySessionStore();
    useCase = new GetActiveSessions(sessionStore);
  });

  it('returns all sessions for a user', async () => {
    const userId = 'user-xyz';
    await seedSessions(sessionStore, userId, 3);

    const result = await useCase.execute({ userId });
    expect(result.isSuccess).toBe(true);
    expect(result.getValue().length).toBe(3);
  });

  it('returns empty array when no sessions', async () => {
    const result = await useCase.execute({ userId: 'no-sessions' });
    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toEqual([]);
  });

  it('never exposes refreshTokenHash in session response', async () => {
    const userId = 'user-abc';
    await seedSessions(sessionStore, userId, 1);

    const result = await useCase.execute({ userId });
    const session = result.getValue()[0];
    // SessionResponse interface has no refreshTokenHash field
    expect((session as any).refreshTokenHash).toBeUndefined();
  });

  it('maps session fields correctly', async () => {
    const userId = 'user-map';
    const sessionId = randomUUID();
    const createdAt = new Date();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await sessionStore.persist({
      userId,
      sessionId,
      refreshTokenHash: 'hashed:token',
      deviceInfo: 'iPhone 15',
      ipAddress: '10.0.0.1',
      createdAt,
      expiresAt,
    });

    const result = await useCase.execute({ userId });
    const session = result.getValue()[0];
    expect(session.sessionId).toBe(sessionId);
    expect(session.device).toBe('iPhone 15');
    expect(session.ip).toBe('10.0.0.1');
    expect(session.createdAt).toEqual(createdAt);
    expect(session.expiresAt).toEqual(expiresAt);
  });
});
