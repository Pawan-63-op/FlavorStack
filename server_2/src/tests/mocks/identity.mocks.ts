import { DomainEvent } from '../../domain/shared/DomainEvent';
import { Result } from '../../domain/shared/Result';
import { IUnitOfWork } from '../../application/shared/ports/IUnitOfWork';
import { IOutboxStore } from '../../application/shared/outbox/IOutboxStore';
import { ISessionStore, SessionData } from '../../domain/identity/services/ISessionStore';
import { IOtpStore } from '../../domain/identity/services/IOtpStore';
import { IOtpGenerator } from '../../domain/identity/services/IOtpGenerator';
import { ISmsProvider } from '../../domain/identity/services/ISmsProvider';
import { IEmailProvider } from '../../domain/identity/services/IEmailProvider';
import { IEmailQueue } from '../../application/shared/queues/IEmailQueue';
import { EmailJob, EnqueueOptions } from '../../application/shared/queues/jobs';
import { IPasswordHasher } from '../../domain/identity/services/IPasswordHasher';
import { IRefreshTokenHasher } from '../../domain/identity/services/IRefreshTokenHasher';
import { ITokenService } from '../../domain/identity/services/ITokenService';
import { TokenPayLoad } from '../../domain/identity/value-objects/TokenPayLoad.vo';
import { PhoneNumber } from '../../domain/identity/value-objects/PhoneNumber.vo';
import { Email } from '../../domain/identity/value-objects/Email.vo';

export class InMemoryUnitOfWork implements IUnitOfWork {
  committed = false;
  rollbackCount = 0;

  private _forceFailError: Error | null = null;

  forceFailOnCommit(error: Error = new Error('Forced commit failure')): void {
    this._forceFailError = error;
  }

  async runInTransaction<T>(work: (ctx: unknown) => Promise<T>): Promise<T> {
    const ctx = {};
    if (this._forceFailError) {
      const err = this._forceFailError;
      this._forceFailError = null;
      this.rollbackCount += 1;
      try { await work(ctx); } catch (_) { /* ignore work errors in forced-fail mode */ }
      throw err;
    }
    try {
      const result = await work(ctx);
      this.committed = true;
      return result;
    } catch (e) {
      this.rollbackCount += 1;
      throw e;
    }
  }
}

export class InMemoryOutboxStore implements IOutboxStore {
  appended: DomainEvent[] = [];

  async append(events: DomainEvent[], _ctx: unknown): Promise<void> {
    this.appended.push(...events);
  }

  clear(): void {
    this.appended = [];
  }
}

export class InMemorySessionStore implements ISessionStore {
  readonly sessions = new Map<string, SessionData>();

  private key(userId: string, sessionId: string): string {
    return `${userId}:${sessionId}`;
  }

  async persist(session: SessionData): Promise<void> {
    this.sessions.set(this.key(session.userId, session.sessionId), session);
  }

  async find(userId: string, sessionId: string): Promise<SessionData | null> {
    return this.sessions.get(this.key(userId, sessionId)) ?? null;
  }

  async invalidate(userId: string, sessionId: string): Promise<void> {
    this.sessions.delete(this.key(userId, sessionId));
  }

  async invalidateAll(userId: string): Promise<void> {
    for (const k of Array.from(this.sessions.keys())) {
      if (k.startsWith(`${userId}:`)) {
        this.sessions.delete(k);
      }
    }
  }

  async list(userId: string): Promise<SessionData[]> {
    const result: SessionData[] = [];
    for (const [k, v] of this.sessions.entries()) {
      if (k.startsWith(`${userId}:`)) {
        result.push(v);
      }
    }
    return result;
  }
}

interface OtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}

export class InMemoryOtpStore implements IOtpStore {
  private store = new Map<string, OtpEntry>();

  async issue(key: string, code: string, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      code,
      expiresAt: Date.now() + ttlSeconds * 1000,
      attempts: 0,
    });
  }

  async verify(key: string, code: string): Promise<Result<void>> {
    const entry = this.store.get(key);
    if (!entry) {
      return Result.fail<void>('OTP_INVALID');
    }
    if (Date.now() > entry.expiresAt) {
      return Result.fail<void>('OTP_EXPIRED');
    }
    if (entry.attempts >= 5) {
      return Result.fail<void>('OTP_MAX_ATTEMPTS');
    }
    if (entry.code !== code) {
      entry.attempts += 1;
      return Result.fail<void>('OTP_INVALID');
    }
    entry.attempts += 1;
    return Result.ok<void>();
  }

  async consume(key: string): Promise<void> {
    this.store.delete(key);
  }
}

export class FakeOtpGenerator implements IOtpGenerator {
  constructor(private code: string = '111111') {}

  generate(_length?: number): string {
    return this.code;
  }
}

export class FakeSmsProvider implements ISmsProvider {
  sent: Array<{ phone: string; code: string }> = [];

  async sendOtp(phone: PhoneNumber, code: string): Promise<void> {
    this.sent.push({ phone: phone.value, code });
  }
}

export class FakeEmailProvider implements IEmailProvider {
  sent: Array<{ type: string; to: string; payload: unknown }> = [];

  async sendVerification(to: Email, token: string): Promise<void> {
    this.sent.push({ type: 'verification', to: to.value, payload: { token } });
  }

  async sendPasswordReset(to: Email, token: string): Promise<void> {
    this.sent.push({ type: 'passwordReset', to: to.value, payload: { token } });
  }

  async sendNotification(to: Email, subject: string, body: string): Promise<void> {
    this.sent.push({ type: 'notification', to: to.value, payload: { subject, body } });
  }
}

export class FakeEmailQueue implements IEmailQueue {
  enqueued: Array<{ job: EmailJob; opts?: EnqueueOptions }> = [];
  closed = false;

  async enqueue(job: EmailJob, opts?: EnqueueOptions): Promise<void> {
    this.enqueued.push({ job, opts });
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

export class FakePasswordHasher implements IPasswordHasher {
  async hash(plain: string): Promise<string> {
    return `hashed:${plain}`;
  }

  async compare(plain: string, hash: string): Promise<boolean> {
    return hash === `hashed:${plain}`;
  }
}

export class FakeRefreshTokenHasher implements IRefreshTokenHasher {
  hash(token: string): string {
    return `rthash:${token}`;
  }

  compare(token: string, hash: string): boolean {
    return hash === `rthash:${token}`;
  }
}

export class FakeTokenService implements ITokenService {
  private _verifyResult: Result<TokenPayLoad> | null = null;

  /** Force the next verify() call to return a specific result (for negative tests). */
  setVerifyResult(result: Result<TokenPayLoad>): void {
    this._verifyResult = result;
  }

  generateAccessToken(payload: TokenPayLoad): string {
    return `access.${Buffer.from(JSON.stringify(payload)).toString('base64')}`;
  }

  generateRefreshToken(payload: TokenPayLoad): string {
    return `refresh.${Buffer.from(JSON.stringify(payload)).toString('base64')}`;
  }

  verify(token: string): Result<TokenPayLoad> {
    if (this._verifyResult) {
      const r = this._verifyResult;
      this._verifyResult = null;
      return r;
    }
    return this._decode(token);
  }

  decode(token: string): TokenPayLoad | null {
    const result = this._decode(token);
    return result.isSuccess ? result.getValue() : null;
  }

  private _decode(token: string): Result<TokenPayLoad> {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return Result.fail('invalid_token_format');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8')) as TokenPayLoad;
      return Result.ok(payload);
    } catch {
      return Result.fail('invalid_token_format');
    }
  }
}

import { BaseUser } from '../../domain/identity/entities/BaseUser';
import {
  IUserRepository,
  ListUsersFilter,
  ListUsersResult,
} from '../../domain/identity/repositories/IUserRepository';

export class InMemoryUserRepository implements IUserRepository {
  readonly users = new Map<string, BaseUser>();

  async save(user: BaseUser): Promise<void> {
    this.users.set(user._id, user);
  }

  async update(user: BaseUser): Promise<void> {
    this.users.set(user._id, user);
  }

  async softDelete(id: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.softDelete();
    }
  }

  async findById(id: string): Promise<BaseUser | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: Email): Promise<BaseUser | null> {
    for (const user of this.users.values()) {
      if (user.email === email.value) return user;
    }
    return null;
  }

  async existsByEmail(email: Email): Promise<boolean> {
    for (const user of this.users.values()) {
      if (user.email === email.value) return true;
    }
    return false;
  }

  async list(filter: ListUsersFilter): Promise<ListUsersResult> {
    let all = Array.from(this.users.values()).filter((u) => !u.isDeleted);
    if (filter.role) all = all.filter((u) => u.role === filter.role);
    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      all = all.filter(
        (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
      );
    }
    all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const items = all.slice(filter.offset, filter.offset + filter.limit);
    return { items, total: all.length };
  }
}

import { Customer } from '../../domain/identity/entities/Customer';
import { ICustomerRepository } from '../../domain/identity/repositories/ICustomerRepository';

export class InMemoryCustomerRepository implements ICustomerRepository {
  private userRepo: InMemoryUserRepository;

  constructor(userRepo: InMemoryUserRepository) {
    this.userRepo = userRepo;
  }

  async findByReferralCode(code: string): Promise<Customer | null> {
    for (const user of this.userRepo.users.values()) {
      if (user instanceof Customer && user.referralCode === code) {
        return user;
      }
    }
    return null;
  }
}
