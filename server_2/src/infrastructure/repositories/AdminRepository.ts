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
