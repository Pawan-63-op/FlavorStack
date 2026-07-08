import { ISessionStore, SessionData } from '../../domain/identity/services/ISessionStore';
import { RedisClient } from './client';
import { sessionKey, sessionIndexKey } from './keys';

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

type SerializedSessionData = Omit<SessionData, 'createdAt' | 'expiresAt'> & {
  createdAt: string;
  expiresAt: string;
};

export class SessionStore implements ISessionStore {
  constructor(private readonly redisClient: RedisClient) {}

  async persist(session: SessionData): Promise<void> {
    const payload: SerializedSessionData = {
      ...session,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    };

    const indexKey = sessionIndexKey(session.userId);

    await this.redisClient
      .getClient()
      .pipeline()
      .set(sessionKey(session.userId, session.sessionId), JSON.stringify(payload), 'EX', SESSION_TTL_SECONDS)
      .sadd(indexKey, session.sessionId)
      .expire(indexKey, SESSION_TTL_SECONDS)
      .exec();
  }

  async find(userId: string, sessionId: string): Promise<SessionData | null> {
    const raw = await this.redisClient.getClient().get(sessionKey(userId, sessionId));
    return raw ? this.deserialize(raw) : null;
  }

  async invalidate(userId: string, sessionId: string): Promise<void> {
    await this.redisClient
      .getClient()
      .pipeline()
      .del(sessionKey(userId, sessionId))
      .srem(sessionIndexKey(userId), sessionId)
      .exec();
  }

  async invalidateAll(userId: string): Promise<void> {
    const indexKey = sessionIndexKey(userId);
    const sessionIds = await this.redisClient.getClient().smembers(indexKey);

    const pipeline = this.redisClient.getClient().pipeline();
    for (const sessionId of sessionIds) {
      pipeline.del(sessionKey(userId, sessionId));
    }
    pipeline.del(indexKey);
    await pipeline.exec();
  }

  async list(userId: string): Promise<SessionData[]> {
    const indexKey = sessionIndexKey(userId);
    const sessionIds = await this.redisClient.getClient().smembers(indexKey);
    if (sessionIds.length === 0) {
      return [];
    }

    const keys = sessionIds.map((sessionId) => sessionKey(userId, sessionId));
    const values = await this.redisClient.getClient().mget(...keys);

    const sessions: SessionData[] = [];
    const expiredSessionIds: string[] = [];

    values.forEach((raw, index) => {
      if (raw === null) {
        expiredSessionIds.push(sessionIds[index]);
      } else {
        sessions.push(this.deserialize(raw));
      }
    });

    if (expiredSessionIds.length > 0) {
      await this.redisClient.getClient().srem(indexKey, ...expiredSessionIds);
    }

    return sessions;
  }

  private deserialize(raw: string): SessionData {
    const parsed = JSON.parse(raw) as SerializedSessionData;
    return {
      ...parsed,
      createdAt: new Date(parsed.createdAt),
      expiresAt: new Date(parsed.expiresAt),
    };
  }
}
