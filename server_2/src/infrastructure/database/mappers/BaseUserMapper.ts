import { BaseUser } from '../../../domain/identity/entities/BaseUser';
import { UserDocument } from '../models/UserModel';
import { Result } from '../../../domain/shared/Result';
import { DomainError } from '../../../domain/shared/errors/DomainError';

export function rebuildOrThrow<T>(result: Result<T>, context: string): T {
  if (result.isFailure) {
    throw new DomainError(
      `Failed to rebuild ${context} from persisted data: ${String(result.getError())}`,
      'PERSISTENCE_MAPPING_ERROR'
    );
  }
  return result.getValue();
}

export function baseToPersistence(user: BaseUser): UserDocument {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    role: user.role,
    passwordHash: user.passwordHash,
    authProvider: user.authProvider,
    providerId: user.providerId,
    isEmailVerified: user.isEmailVerified,
    passwordChangedAt: user.passwordChangedAt,
    tokenVersion: user.tokenVersion,
    loginAttempts: user.loginAttempts,
    lockUntil: user.lockUntil,
    lastLoginAt: user.lastLoginAt,
    lastLoginIp: user.lastLoginIp,
    isBanned: user.isBanned,
    banReason: user.banReason,
    isActive: user.isActive,
    deletedAt: user.deletedAt,
    version: user.version,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function baseToDomain(doc: UserDocument): Partial<BaseUser> {
  return {
    _id: doc._id,
    name: doc.name,
    email: doc.email,
    phone: doc.phone,
    avatarUrl: doc.avatarUrl,
    role: doc.role,
    passwordHash: doc.passwordHash,
    authProvider: doc.authProvider,
    providerId: doc.providerId,
    isEmailVerified: doc.isEmailVerified,
    passwordChangedAt: doc.passwordChangedAt,
    tokenVersion: doc.tokenVersion,
    loginAttempts: doc.loginAttempts,
    lockUntil: doc.lockUntil,
    lastLoginAt: doc.lastLoginAt,
    lastLoginIp: doc.lastLoginIp,
    isBanned: doc.isBanned,
    banReason: doc.banReason,
    isActive: doc.isActive,
    deletedAt: doc.deletedAt,
    version: doc.version,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
