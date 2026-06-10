// MongoDB implementation of IUserRepository (Phase 6, Batch 4).
//
// Persists the polymorphic BaseUser hierarchy (Customer/Driver/Admin) through a
// single `users` collection discriminated on `role`. All translation goes through
// UserMapper — the repository never accepts or returns Mongoose documents.
//
// Session propagation: the active Mongo ClientSession is read implicitly from the
// shared TransactionContext (AsyncLocalStorage) and attached to every operation.
// Outside a transaction getSession() is undefined and operations run on the
// connection's default auto-committed session. This keeps IUserRepository free of
// a `ctx` parameter (Phase-4/Phase-5 contracts stay frozen).
//
// Soft delete: every finder filters `deletedAt: null` explicitly (no pre-find
// plugin), and softDelete sets `deletedAt`/`isActive` rather than removing rows.
//
// Optimistic locking: update is guarded on the domain `version` field via
// findOneAndUpdate({ _id, version }, { $inc: { version: 1 } }); a non-match means a
// concurrent writer won (or the row is gone) and surfaces as a ConflictError.
import type { ClientSession, Model } from 'mongoose';
import { IUserRepository } from '../../domain/identity/repositories/IUserRepository';
import { BaseUser } from '../../domain/identity/entities/BaseUser';
import { Email } from '../../domain/identity/value-objects/Email.vo';
import { UserRole, USER_ROLE } from '../../domain/identity/enums/user-role.enum';
import { ConflictError } from '../../domain/shared/errors/ConflictError';
import { DomainError } from '../../domain/shared/errors/DomainError';
import { TransactionContext } from '../database/TransactionContext';
import { UserModel } from '../database/models/UserModel';
import { CustomerModel } from '../database/models/CustomerModel';
import { DriverModel } from '../database/models/DriverModel';
import { AdminModel } from '../database/models/AdminModel';
import { UserMapper, AnyUserDocument } from '../database/mappers/UserMapper';

export class MongoUserRepository implements IUserRepository {
  constructor(private readonly txContext: TransactionContext) {}

  private get session(): ClientSession | undefined {
    return this.txContext.getSession();
  }

  // Writes go through the concrete discriminator model so role-specific fields are
  // persisted (the base UserModel strips fields it doesn't know about). Reads use
  // the base UserModel, which returns the full stored document for any subtype.
  private modelFor(role: UserRole): Model<AnyUserDocument> {
    switch (role) {
      case USER_ROLE.CUSTOMER:
        return CustomerModel as unknown as Model<AnyUserDocument>;
      case USER_ROLE.DRIVER:
        return DriverModel as unknown as Model<AnyUserDocument>;
      case USER_ROLE.ADMIN:
        return AdminModel as unknown as Model<AnyUserDocument>;
      default:
        throw new DomainError(`Unknown user role "${role}"`, 'UNKNOWN_USER_ROLE');
    }
  }

  async save(user: BaseUser): Promise<void> {
    const doc = UserMapper.toPersistence(user);
    // The array form is required when passing per-operation options (session).
    await this.modelFor(user.role).create([doc], { session: this.session });
  }

  async update(user: BaseUser): Promise<void> {
    const doc = UserMapper.toPersistence(user) as unknown as Record<string, unknown>;
    // `_id` and `role` are immutable; `version` is advanced via $inc, not $set.
    const fields = { ...doc };
    delete fields._id;
    delete fields.role;
    delete fields.version;

    const result = await this.modelFor(user.role).findOneAndUpdate(
      { _id: user._id, version: user.version },
      { $set: fields, $inc: { version: 1 } },
      // We only need to know whether a row matched the version guard; the returned
      // document itself is unused, so the default (pre-update) return is fine.
      { session: this.session },
    );

    if (result === null) {
      throw new ConflictError('Optimistic lock conflict: user was modified or removed concurrently', {
        id: user._id,
        expectedVersion: user.version,
      });
    }
  }

  async softDelete(id: string): Promise<void> {
    await UserModel.updateOne(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date(), isActive: false } },
      { session: this.session },
    );
  }

  async findById(id: string): Promise<BaseUser | null> {
    const doc = await UserModel.findOne({ _id: id, deletedAt: null }, null, {
      session: this.session,
    }).lean<AnyUserDocument>();
    return doc ? UserMapper.toDomain(doc) : null;
  }

  async findByEmail(email: Email): Promise<BaseUser | null> {
    const doc = await UserModel.findOne({ email: email.value, deletedAt: null }, null, {
      session: this.session,
    }).lean<AnyUserDocument>();
    return doc ? UserMapper.toDomain(doc) : null;
  }

  async existsByEmail(email: Email): Promise<boolean> {
    const found = await UserModel.exists({ email: email.value, deletedAt: null }).session(
      this.session ?? null,
    );
    return found !== null;
  }
}
