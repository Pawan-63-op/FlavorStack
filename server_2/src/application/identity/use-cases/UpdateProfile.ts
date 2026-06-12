import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { IUserRepository } from '../../../domain/identity/repositories/IUserRepository';
import { UpdateProfileDto } from '../dtos/UpdateProfileDto';
import { UserResponse } from '../responses/UserResponse';
import { toUserResponse } from '../responses/mappers';

export class UpdateProfile {
  constructor(private userRepo: IUserRepository) {}

  async execute(dto: UpdateProfileDto): Promise<Result<UserResponse>> {
    const user = await this.userRepo.findById(dto.userId);
    if (!user) return Result.fail(new NotFoundError('user_not_found'));

    user.updateProfile({ name: dto.name, avatarUrl: dto.avatarUrl });
    await this.userRepo.update(user);

    return Result.ok(toUserResponse(user));
  }
}
