import { BaseUser } from '../entities/BaseUser';
import { Email } from '../value-objects/Email.vo';

export interface IUserRepository {
  save(user: BaseUser): Promise<void>;
  update(user: BaseUser): Promise<void>;
  softDelete(id: string): Promise<void>;
  findById(id: string): Promise<BaseUser | null>;
  findByEmail(email: Email): Promise<BaseUser | null>;
  existsByEmail(email: Email): Promise<boolean>;
}
