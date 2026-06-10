// Dispatching mapper for the BaseUser hierarchy. Selects the per-role mapper
// (CustomerMapper / DriverMapper / AdminMapper) based on the `role` discriminator.
import { BaseUser } from '../../../domain/identity/entities/BaseUser';
import { Customer } from '../../../domain/identity/entities/Customer';
import { Driver } from '../../../domain/identity/entities/Driver';
import { Admin } from '../../../domain/identity/entities/Admin';
import { USER_ROLE } from '../../../domain/identity/enums/user-role.enum';
import { CustomerDocument } from '../models/CustomerModel';
import { DriverDocument } from '../models/DriverModel';
import { AdminDocument } from '../models/AdminModel';
import { CustomerMapper } from './CustomerMapper';
import { DriverMapper } from './DriverMapper';
import { AdminMapper } from './AdminMapper';
import { DomainError } from '../../../domain/shared/errors/DomainError';

export type AnyUserDocument = CustomerDocument | DriverDocument | AdminDocument;

export class UserMapper {
  static toDomain(doc: AnyUserDocument): BaseUser {
    switch (doc.role) {
      case USER_ROLE.CUSTOMER:
        return CustomerMapper.toDomain(doc as CustomerDocument);
      case USER_ROLE.DRIVER:
        return DriverMapper.toDomain(doc as DriverDocument);
      case USER_ROLE.ADMIN:
        return AdminMapper.toDomain(doc as AdminDocument);
      default:
        throw new DomainError(`Unknown user role "${doc.role}" in persisted document (${doc._id})`, 'UNKNOWN_USER_ROLE');
    }
  }

  static toPersistence(user: BaseUser): AnyUserDocument {
    switch (user.role) {
      case USER_ROLE.CUSTOMER:
        return CustomerMapper.toPersistence(user as Customer);
      case USER_ROLE.DRIVER:
        return DriverMapper.toPersistence(user as Driver);
      case USER_ROLE.ADMIN:
        return AdminMapper.toPersistence(user as Admin);
      default:
        throw new DomainError(`Unknown user role "${user.role}" on aggregate (${user._id})`, 'UNKNOWN_USER_ROLE');
    }
  }
}
