import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../domain/shared/errors/ForbiddenError';
import { ConflictError } from '../../../domain/shared/errors/ConflictError';
import { IUserRepository } from '../../../domain/identity/repositories/IUserRepository';
import { Driver } from '../../../domain/identity/entities/Driver';
import { DRIVER_STATUS } from '../../../domain/identity/enums/driver-status.enum';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IEventBus } from '../../shared/events/IEventBus';

export interface VerifyDriverDto {
  driverId: string;
}

export interface VerifyDriverResponse {
  driverStatus: string;
  isAvailable: boolean;
  isOnline: boolean;
}

export class VerifyDriver {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly unitOfWork: IUnitOfWork,
    private readonly eventBus: IEventBus,
  ) {}

  async execute(dto: VerifyDriverDto): Promise<Result<VerifyDriverResponse>> {
    const user = await this.userRepo.findById(dto.driverId);
    if (!user) return Result.fail(new NotFoundError('user_not_found'));
    if (!(user instanceof Driver)) return Result.fail(new ForbiddenError('not_a_driver'));

    const isVerifiable =
      user.driverStatus === DRIVER_STATUS.PENDING_VERIFICATION ||
      user.driverStatus === DRIVER_STATUS.SUSPENDED;
    if (!isVerifiable) return Result.fail(new ConflictError('driver_already_verified'));

    user.verifyDriver();
    const events = user.pullDomainEvents();

    await this.unitOfWork.runInTransaction(async () => {
      await this.userRepo.update(user);
    });

    await this.eventBus.publishAll(events);

    return Result.ok<VerifyDriverResponse>({
      driverStatus: user.driverStatus,
      isAvailable: user.isAvailable,
      isOnline: user.isOnline,
    });
  }
}
