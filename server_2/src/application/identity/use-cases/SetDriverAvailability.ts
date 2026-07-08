import { Result } from '../../../domain/shared/Result';
import { DomainError } from '../../../domain/shared/errors/DomainError';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../domain/shared/errors/ForbiddenError';
import { IUserRepository } from '../../../domain/identity/repositories/IUserRepository';
import { Driver } from '../../../domain/identity/entities/Driver';

export interface SetDriverAvailabilityDto {
  userId: string;
  available: boolean;
}

export interface DriverAvailabilityResponse {
  driverStatus: string;
  isAvailable: boolean;
  isOnline: boolean;
}

export class SetDriverAvailability {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(dto: SetDriverAvailabilityDto): Promise<Result<DriverAvailabilityResponse>> {
    const user = await this.userRepo.findById(dto.userId);
    if (!user) return Result.fail(new NotFoundError('user_not_found'));
    if (!(user instanceof Driver)) return Result.fail(new ForbiddenError('not_a_driver'));

    try {
      if (dto.available) user.goOnline();
      else user.goOffline();
    } catch (err) {
      if (err instanceof DomainError) return Result.fail(err);
      throw err; // unexpected — let it bubble to the global handler
    }

    await this.userRepo.update(user);

    return Result.ok<DriverAvailabilityResponse>({
      driverStatus: user.driverStatus,
      isAvailable: user.isAvailable,
      isOnline: user.isOnline,
    });
  }
}
