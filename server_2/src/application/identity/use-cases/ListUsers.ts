import { Result } from '../../../domain/shared/Result';
import { ValidationError } from '../../../domain/shared/errors/ValidationError';
import { IUserRepository } from '../../../domain/identity/repositories/IUserRepository';
import { Driver } from '../../../domain/identity/entities/Driver';
import { USER_ROLE, UserRole } from '../../../domain/identity/enums/user-role.enum';

export interface ListUsersDto {
  limit: number;
  offset: number;
  role?: string;
  search?: string;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  isBanned: boolean;
  banReason: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  driverStatus: string | null;
  createdAt: Date;
}

export interface ListUsersResponse {
  users: UserSummary[];
  total: number;
  limit: number;
  offset: number;
}

export class ListUsers {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(dto: ListUsersDto): Promise<Result<ListUsersResponse>> {
    let role: UserRole | undefined;
    if (dto.role !== undefined) {
      const valid = (Object.values(USER_ROLE) as string[]).includes(dto.role);
      if (!valid) return Result.fail(new ValidationError('invalid_user_role'));
      role = dto.role as UserRole;
    }

    const { items, total } = await this.userRepo.list({
      limit: dto.limit,
      offset: dto.offset,
      role,
      search: dto.search,
    });

    return Result.ok<ListUsersResponse>({
      users: items.map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        isBanned: u.isBanned ?? false,
        banReason: u.banReason ?? null,
        isActive: u.isActive ?? true,
        isEmailVerified: u.isEmailVerified ?? false,
        driverStatus: u instanceof Driver ? u.driverStatus : null,
        createdAt: u.createdAt,
      })),
      total,
      limit: dto.limit,
      offset: dto.offset,
    });
  }
}
