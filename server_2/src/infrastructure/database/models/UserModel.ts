import { Schema, model } from 'mongoose';
import { USER_ROLE, UserRole } from '../../../domain/identity/enums/user-role.enum';
import { AUTH_PROVIDER, AuthProvider } from '../../../domain/identity/enums/auth-provider.enum';

export interface UserDocument {
  _id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl: string;
  role: UserRole;
  passwordHash: string;
  authProvider: AuthProvider;
  providerId: string;
  isEmailVerified: boolean;
  passwordChangedAt: Date | null;
  tokenVersion: number;
  loginAttempts: number;
  lockUntil: Date | null;
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
  isBanned: boolean;
  banReason: string | null;
  isActive: boolean;
  deletedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = new Schema<UserDocument>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
    avatarUrl: { type: String, default: '' },
    role: { type: String, enum: Object.values(USER_ROLE), required: true },
    passwordHash: { type: String, default: '' },
    authProvider: { type: String, enum: Object.values(AUTH_PROVIDER), default: AUTH_PROVIDER.LOCAL },
    providerId: { type: String, default: '' },
    isEmailVerified: { type: Boolean, default: false },
    passwordChangedAt: { type: Date, default: null },
    tokenVersion: { type: Number, default: 0 },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    lastLoginIp: { type: String, default: null },
    isBanned: { type: Boolean, default: false },
    banReason: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
    version: { type: Number, default: 0 },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  {
    versionKey: false,
    timestamps: false,
    discriminatorKey: 'role',
    collection: 'users',
  }
);

UserSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });
UserSchema.index({ phone: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });
UserSchema.index({ role: 1 });
UserSchema.index({ deletedAt: 1 }, { sparse: true });

export const UserModel = model<UserDocument>('User', UserSchema);
