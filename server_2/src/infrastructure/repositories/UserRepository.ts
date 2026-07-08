import type { ClientSession, Model } from 'mongoose';
import {
  IUserRepository,
  ListUsersFilter,
  ListUsersResult,
} from '../../domain/identity/repositories/IUserRepository';
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
    await this.modelFor(user.role).create([doc], { session: this.session });
  }

  async update(user: BaseUser): Promise<void> {
    const doc = UserMapper.toPersistence(user) as unknown as Record<string, unknown>;
    const fields = { ...doc };
    delete fields._id;
    delete fields.role;
    delete fields.version;

    const result = await this.modelFor(user.role).findOneAndUpdate(
      { _id: user._id, version: user.version },
      { $set: fields, $inc: { version: 1 } },
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

  async list(filter: ListUsersFilter): Promise<ListUsersResult> {
    const query: Record<string, unknown> = { deletedAt: null };
    if (filter.role) query.role = filter.role;
    if (filter.search && filter.search.trim()) {
      const safe = filter.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(safe, 'i');
      query.$or = [{ name: rx }, { email: rx }];
    }

    const [docs, total] = await Promise.all([
      UserModel.find(query, null, { session: this.session })
        .sort({ createdAt: -1 })
        .skip(filter.offset)
        .limit(filter.limit)
        .lean<AnyUserDocument[]>(),
      UserModel.countDocuments(query).session(this.session ?? null),
    ]);

    return { items: docs.map((doc) => UserMapper.toDomain(doc)), total };
  }
}
