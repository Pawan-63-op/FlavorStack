import { StartedRedisContainer } from '@testcontainers/redis';
import { RedisClient } from '../../../infrastructure/redis/client';
import { SessionStore } from '../../../infrastructure/redis/SessionStore';
import { SessionData } from '../../../domain/identity/services/ISessionStore';
import { sessionKey, sessionIndexKey } from '../../../infrastructure/redis/keys';
import { startRedisContainer, StartedTestRedis } from './redis-container';

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

function buildSession(overrides: Partial<SessionData> = {}): SessionData {
  return {
    userId: 'user-1',
    sessionId: 'session-1',
    refreshTokenHash: 'hashed-refresh-token',
    deviceInfo: 'iPhone 15',
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    expiresAt: new Date('2026-01-31T00:00:00.000Z'),
    ...overrides,
  };
}

describe('SessionStore', () => {
  let started: StartedTestRedis;
  let container: StartedRedisContainer;
  let client: RedisClient;
  let store: SessionStore;

  beforeAll(async () => {
    started = await startRedisContainer();
    container = started.container;
    client = new RedisClient(started.config);
    await client.connect();
    store = new SessionStore(client);
  });

  afterAll(async () => {
    await client.shutdown();
    await container.stop();
  });

  beforeEach(async () => {
    await client.getClient().flushall();
  });

  it('persists and finds a session with Date round-trip intact', async () => {
    const session = buildSession();

    await store.persist(session);
    const found = await store.find(session.userId, session.sessionId);

    expect(found).toEqual(session);
    expect(found?.createdAt).toBeInstanceOf(Date);
    expect(found?.expiresAt).toBeInstanceOf(Date);
  });

  it('returns null for a missing session', async () => {
    const found = await store.find('no-such-user', 'no-such-session');

    expect(found).toBeNull();
  });

  it('sets a 30-day TTL on the session key', async () => {
    const session = buildSession();

    await store.persist(session);
    const ttl = await client.getClient().ttl(sessionKey(session.userId, session.sessionId));

    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(THIRTY_DAYS_SECONDS);
    expect(ttl).toBeGreaterThan(THIRTY_DAYS_SECONDS - 60);
  });

  it('refreshes the index TTL on persist', async () => {
    const session = buildSession();

    await store.persist(session);
    const ttl = await client.getClient().ttl(sessionIndexKey(session.userId));

    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(THIRTY_DAYS_SECONDS);
  });

  it('lists all sessions persisted for a user', async () => {
    const sessionA = buildSession({ sessionId: 'session-a' });
    const sessionB = buildSession({ sessionId: 'session-b' });

    await store.persist(sessionA);
    await store.persist(sessionB);
    const sessions = await store.list(sessionA.userId);

    expect(sessions).toHaveLength(2);
    expect(sessions).toEqual(expect.arrayContaining([sessionA, sessionB]));
  });

  it('prunes expired sessions from the index when listing', async () => {
    const live = buildSession({ sessionId: 'session-live' });
    const expiring = buildSession({ sessionId: 'session-expiring' });

    await store.persist(live);
    await store.persist(expiring);
    await client.getClient().pexpire(sessionKey(expiring.userId, expiring.sessionId), 1);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const sessions = await store.list(live.userId);

    expect(sessions).toEqual([live]);
    const indexMembers = await client.getClient().smembers(sessionIndexKey(live.userId));
    expect(indexMembers).toEqual([live.sessionId]);
  });

  it('invalidates a single session, leaving others and updating the index', async () => {
    const sessionA = buildSession({ sessionId: 'session-a' });
    const sessionB = buildSession({ sessionId: 'session-b' });

    await store.persist(sessionA);
    await store.persist(sessionB);
    await store.invalidate(sessionA.userId, sessionA.sessionId);

    expect(await store.find(sessionA.userId, sessionA.sessionId)).toBeNull();
    expect(await store.find(sessionB.userId, sessionB.sessionId)).toEqual(sessionB);
    const indexMembers = await client.getClient().smembers(sessionIndexKey(sessionA.userId));
    expect(indexMembers).toEqual([sessionB.sessionId]);
  });

  it('invalidates all sessions for a user and removes the index', async () => {
    const sessionA = buildSession({ sessionId: 'session-a' });
    const sessionB = buildSession({ sessionId: 'session-b' });

    await store.persist(sessionA);
    await store.persist(sessionB);
    await store.invalidateAll(sessionA.userId);

    expect(await store.find(sessionA.userId, sessionA.sessionId)).toBeNull();
    expect(await store.find(sessionB.userId, sessionB.sessionId)).toBeNull();
    expect(await store.list(sessionA.userId)).toEqual([]);
    const indexExists = await client.getClient().exists(sessionIndexKey(sessionA.userId));
    expect(indexExists).toBe(0);
  });

  it('returns an empty list for a user with no sessions', async () => {
    const sessions = await store.list('user-without-sessions');

    expect(sessions).toEqual([]);
  });
});
