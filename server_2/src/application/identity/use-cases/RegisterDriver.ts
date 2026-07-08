import { Result } from '../../../domain/shared/Result';
import { ConflictError } from '../../../domain/shared/errors/ConflictError';
import { Email } from '../../../domain/identity/value-objects/Email.vo';
import { Password } from '../../../domain/identity/value-objects/Password.vo';
import { VehicleInfo } from '../../../domain/identity/value-objects/VehicleInfo.vo';
import { Driver } from '../../../domain/identity/entities/Driver';
import { IUserRepository } from '../../../domain/identity/repositories/IUserRepository';
import { IPasswordHasher } from '../../../domain/identity/services/IPasswordHasher';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IOutboxStore } from '../../shared/outbox/IOutboxStore';
import { IEventBus } from '../../shared/events/IEventBus';
import { RegisterDriverDto } from '../dtos/RegisterDriverDto';
import { AuthResponse } from '../responses/AuthResponse';
import { toAuthResponse } from '../responses/mappers';

export class RegisterDriver {
  constructor(
    private userRepo: IUserRepository,
    private passwordHasher: IPasswordHasher,
    private unitOfWork: IUnitOfWork,
    private outboxStore: IOutboxStore,
    private eventBus: IEventBus,
  ) {}

  async execute(dto: RegisterDriverDto): Promise<Result<AuthResponse>> {
    const emailResult = Email.create(dto.email);
    if (emailResult.isFailure) return Result.fail(emailResult.getError());
    const email = emailResult.getValue();

    const passwordResult = Password.create(dto.password);
    if (passwordResult.isFailure) return Result.fail(passwordResult.getError());

    const exists = await this.userRepo.existsByEmail(email);
    if (exists) return Result.fail(new ConflictError('email_already_registered'));

    const vehicleResult = VehicleInfo.create(dto.vehicle);
    if (vehicleResult.isFailure) return Result.fail(vehicleResult.getError());
    const vehicle = vehicleResult.getValue();

    const passwordHash = await this.passwordHasher.hash(dto.password);

    const driver = Driver.create({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      vehicle,
    });

    const events = driver.pullDomainEvents();

    await this.unitOfWork.runInTransaction(async (ctx) => {
      await this.userRepo.save(driver);
      if (events.length > 0) {
        await this.outboxStore.append(events, ctx);
      }
    });

    await this.eventBus.publishAll(events);

    return Result.ok(toAuthResponse(driver, '', '', 0));
  }
}
