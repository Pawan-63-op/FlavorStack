import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { IUserRepository } from '../../../domain/identity/repositories/IUserRepository';
import { GetProfileDto } from '../dtos/GetProfileDto';
import { UserResponse } from '../responses/UserResponse';
import { toUserResponse } from '../responses/mappers';

export class GetProfile {
  constructor(private userRepo: IUserRepository) {}

  async execute(dto: GetProfileDto): Promise<Result<UserResponse>> {
    const user = await this.userRepo.findById(dto.userId);
    if (!user) return Result.fail(new NotFoundError('user_not_found'));

    return Result.ok(toUserResponse(user));
  }
}
