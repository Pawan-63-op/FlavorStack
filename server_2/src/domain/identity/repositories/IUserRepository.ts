import { BaseUser } from '../entities/BaseUser';
import { Email } from '../value-objects/Email.vo';
import { UserRole } from '../enums/user-role.enum';

/** Admin user-browsing filter (G6). */
export interface ListUsersFilter {
  limit: number;
  offset: number;
  role?: UserRole;
  /** Case-insensitive match against name or email. */
  search?: string;
}

export interface ListUsersResult {
  items: BaseUser[];
  total: number;
}

export interface IUserRepository {
  save(user: BaseUser): Promise<void>;
  update(user: BaseUser): Promise<void>;
  softDelete(id: string): Promise<void>;
  findById(id: string): Promise<BaseUser | null>;
  findByEmail(email: Email): Promise<BaseUser | null>;
  existsByEmail(email: Email): Promise<boolean>;
  /** Admin listing (G6): newest-first, paginated, optional role/search filter. */
  list(filter: ListUsersFilter): Promise<ListUsersResult>;
}
