// MongoDB implementation of IAdminRepository (Phase 6, Batch 5).
//
// Adds the Admin-specific finder on top of the shared `users` collection.
// Writes go through MongoUserRepository (IUserRepository.save/update) — this
// repository only adds queries, reusing AdminModel + AdminMapper from
// Batch 1/2.
//
// findByPermission matches admins that either hold an explicit permission for
// (resource, action) in their embedded `permissions` array, or are flagged
// `isSuperAdmin` (full access regardless of the embedded list — see
// Admin.hasPermission()).
import type { ClientSession } from 'mongoose';
import { IAdminRepository } from '../../domain/identity/repositories/IAdminRepository';
import { Admin } from '../../domain/identity/entities/Admin';
import { PermissionResource } from '../../domain/identity/enums/permission-resource.enum';
import { PermissionAction } from '../../domain/identity/enums/permission-action.enum';
import { TransactionContext } from '../database/TransactionContext';
import { AdminModel, AdminDocument } from '../database/models/AdminModel';
import { AdminMapper } from '../database/mappers/AdminMapper';

export class MongoAdminRepository implements IAdminRepository {
  constructor(private readonly txContext: TransactionContext) {}

  private get session(): ClientSession | undefined {
    return this.txContext.getSession();
  }

  async findByPermission(resource: PermissionResource, action: PermissionAction): Promise<Admin[]> {
    const docs = await AdminModel.find(
      {
        deletedAt: null,
        $or: [{ isSuperAdmin: true }, { permissions: { $elemMatch: { resource, action } } }],
      },
      null,
      { session: this.session },
    ).lean<AdminDocument[]>();
    return docs.map((doc) => AdminMapper.toDomain(doc));
  }
}
