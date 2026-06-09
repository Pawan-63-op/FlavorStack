import { BaseUser } from '../../../../domain/identity/entities/BaseUser';
import { USER_ROLE } from '../../../../domain/identity/enums/user-role.enum';
import { AUTH_PROVIDER } from '../../../../domain/identity/enums/auth-provider.enum';
import { UserVerified } from '../../../../domain/identity/events/UserVerified';
import { PasswordChanged } from '../../../../domain/identity/events/PasswordChanged';
import { PasswordResetRequested } from '../../../../domain/identity/events/PasswordResetRequested';
import { PasswordResetCompleted } from '../../../../domain/identity/events/PasswordResetCompleted';
import { UserBanned } from '../../../../domain/identity/events/UserBanned';
import { UserUnbanned } from '../../../../domain/identity/events/UserUnbanned';

class TestUser extends BaseUser {
  get displayName(): string {
    return this.name;
  }
}

describe('BaseUser Entity Invariants', () => {
  const createDefaultUser = (overrides: Partial<BaseUser> = {}) => {
    return new TestUser({
      _id: 'user-123',
      name: 'John Doe',
      email: 'john.doe@example.com',
      phone: '+919876543210',
      avatarUrl: 'https://example.com/avatar.png',
      role: USER_ROLE.CUSTOMER,
      passwordHash: 'hashedpassword123',
      authProvider: AUTH_PROVIDER.LOCAL,
      providerId: '',
      isEmailVerified: false,
      passwordChangedAt: null,
      tokenVersion: 1,
      loginAttempts: 0,
      lockUntil: null,
      lastLoginAt: null,
      lastLoginIp: null,
      isBanned: false,
      banReason: null,
      isActive: true,
      deletedAt: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });
  };

  describe('Login eligibility and locks', () => {
    it('should allow login attempt when active, not banned, and not locked', () => {
      const user = createDefaultUser();
      expect(user.canAttemptLogin()).toBe(true);
    });

    it('should not allow login attempt when inactive', () => {
      const user = createDefaultUser({ isActive: false });
      expect(user.canAttemptLogin()).toBe(false);
    });

    it('should not allow login attempt when banned', () => {
      const user = createDefaultUser({ isBanned: true });
      expect(user.canAttemptLogin()).toBe(false);
    });

    it('should not allow login attempt when locked', () => {
      const lockTime = new Date(Date.now() + 10 * 60 * 1000); // Locked for 10 mins
      const user = createDefaultUser({ lockUntil: lockTime });
      expect(user.isLocked).toBe(true);
      expect(user.canAttemptLogin()).toBe(false);
    });

    it('should determine if account should lock after next attempt', () => {
      const user = createDefaultUser({ loginAttempts: 4 });
      expect(user.shouldLockAfterAttempt(5)).toBe(true);

      const user2 = createDefaultUser({ loginAttempts: 2 });
      expect(user2.shouldLockAfterAttempt(5)).toBe(false);
    });

    it('should increment login attempts correctly', () => {
      const user = createDefaultUser();
      user.incrementLoginAttempts();
      expect(user.loginAttempts).toBe(1);
    });

    it('should lock account correctly for the specified duration', () => {
      const user = createDefaultUser();
      const now = Date.now();
      user.lockAccount(5000); // Lock for 5 seconds
      expect(user.lockUntil).toBeDefined();
      expect(user.lockUntil!.getTime()).toBeGreaterThanOrEqual(now + 4900);
      expect(user.isLocked).toBe(true);
    });

    it('should record successful login and clear attempt counts', () => {
      const user = createDefaultUser({
        loginAttempts: 4,
        lockUntil: new Date(Date.now() - 1000), // lock expired
      });
      user.recordLogin('192.168.1.1');
      expect(user.loginAttempts).toBe(0);
      expect(user.lockUntil).toBeNull();
      expect(user.lastLoginIp).toBe('192.168.1.1');
      expect(user.lastLoginAt).toBeInstanceOf(Date);
    });

    it('should reset login attempts manually', () => {
      const user = createDefaultUser({
        loginAttempts: 3,
        lockUntil: new Date(),
      });
      user.resetLoginAttempts();
      expect(user.loginAttempts).toBe(0);
      expect(user.lockUntil).toBeNull();
    });
  });

  describe('Email verification event', () => {
    it('should verify email and record UserVerified event', () => {
      const user = createDefaultUser();
      expect(user.isEmailVerified).toBe(false);

      user.verifyEmail();
      expect(user.isEmailVerified).toBe(true);

      const events = user.pullDomainEvents();
      expect(events.length).toBe(1);
      const event = events[0] as UserVerified;
      expect(event).toBeInstanceOf(UserVerified);
      expect(event.eventName).toBe('UserVerified');
      expect(event.aggregateId).toBe(user._id);
      expect(event.email).toBe(user.email);
    });
  });

  describe('Password operations and events', () => {
    it('should change password and record PasswordChanged event', () => {
      const user = createDefaultUser();
      user.changePassword('newhashedpwd123');

      expect(user.passwordHash).toBe('newhashedpwd123');
      expect(user.passwordChangedAt).toBeInstanceOf(Date);

      const events = user.pullDomainEvents();
      expect(events.length).toBe(1);
      const event = events[0] as PasswordChanged;
      expect(event).toBeInstanceOf(PasswordChanged);
      expect(event.eventName).toBe('PasswordChanged');
      expect(event.aggregateId).toBe(user._id);
    });

    it('should request password reset and record PasswordResetRequested event', () => {
      const user = createDefaultUser();
      user.requestPasswordReset();

      const events = user.pullDomainEvents();
      expect(events.length).toBe(1);
      const event = events[0] as PasswordResetRequested;
      expect(event).toBeInstanceOf(PasswordResetRequested);
      expect(event.eventName).toBe('PasswordResetRequested');
      expect(event.aggregateId).toBe(user._id);
      expect(event.email).toBe(user.email);
    });

    it('should complete password reset, increment token version, and record PasswordResetCompleted event', () => {
      const user = createDefaultUser();
      const oldTokenVersion = user.tokenVersion;

      user.completePasswordReset('resetpwd123');
      expect(user.passwordHash).toBe('resetpwd123');
      expect(user.passwordChangedAt).toBeInstanceOf(Date);
      expect(user.tokenVersion).toBe(oldTokenVersion + 1);

      const events = user.pullDomainEvents();
      expect(events.length).toBe(1);
      const event = events[0] as PasswordResetCompleted;
      expect(event).toBeInstanceOf(PasswordResetCompleted);
      expect(event.eventName).toBe('PasswordResetCompleted');
      expect(event.aggregateId).toBe(user._id);
    });
  });

  describe('Ban and Unban events', () => {
    it('should ban user, update active status, and record UserBanned event', () => {
      const user = createDefaultUser();
      user.ban('Violation of terms');

      expect(user.isBanned).toBe(true);
      expect(user.banReason).toBe('Violation of terms');
      expect(user.isActive).toBe(false);

      const events = user.pullDomainEvents();
      expect(events.length).toBe(1);
      const event = events[0] as UserBanned;
      expect(event).toBeInstanceOf(UserBanned);
      expect(event.eventName).toBe('UserBanned');
      expect(event.aggregateId).toBe(user._id);
      expect(event.reason).toBe('Violation of terms');
    });

    it('should unban user, update active status, and record UserUnbanned event', () => {
      const user = createDefaultUser({
        isBanned: true,
        banReason: 'Violation of terms',
        isActive: false,
      });

      user.unban();
      expect(user.isBanned).toBe(false);
      expect(user.banReason).toBeNull();
      expect(user.isActive).toBe(true);

      const events = user.pullDomainEvents();
      expect(events.length).toBe(1);
      const event = events[0] as UserUnbanned;
      expect(event).toBeInstanceOf(UserUnbanned);
      expect(event.eventName).toBe('UserUnbanned');
      expect(event.aggregateId).toBe(user._id);
    });
  });

  describe('Session tracking and soft deletion', () => {
    it('should increment token version manually', () => {
      const user = createDefaultUser();
      const initialVersion = user.tokenVersion;
      user.incrementTokenVersion();
      expect(user.tokenVersion).toBe(initialVersion + 1);
    });

    it('should invalidate all sessions by incrementing token version', () => {
      const user = createDefaultUser();
      const initialVersion = user.tokenVersion;
      user.invalidateAllSessions();
      expect(user.tokenVersion).toBe(initialVersion + 1);
    });

    it('should soft delete user correctly', () => {
      const user = createDefaultUser();
      expect(user.isDeleted).toBe(false);
      expect(user.isActive).toBe(true);

      user.softDelete();
      expect(user.isDeleted).toBe(true);
      expect(user.isActive).toBe(false);
      expect(user.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('Virtuals and Display properties', () => {
    it('should return correct display name', () => {
      const user = createDefaultUser({ name: 'Bob' });
      expect(user.displayName).toBe('Bob');
    });

    it('should return correct public profile object', () => {
      const user = createDefaultUser();
      const profile = user.publicProfile;

      expect(profile.id).toBe(user._id);
      expect(profile.name).toBe(user.name);
      expect(profile.email).toBe(user.email);
      expect(profile.role).toBe(user.role);
      expect(profile.avatarUrl).toBe(user.avatarUrl);
      expect(profile.isEmailVerified).toBe(user.isEmailVerified);
      expect(profile.createdAt).toBe(user.createdAt);
    });
  });
});
