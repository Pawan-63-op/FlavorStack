import { randomUUID } from 'crypto';
import { Result } from '../../../domain/shared/Result';
import { ConflictError } from '../../../domain/shared/errors/ConflictError';
import { Email } from '../../../domain/identity/value-objects/Email.vo';
import { Password } from '../../../domain/identity/value-objects/Password.vo';
import { Address } from '../../../domain/identity/value-objects/Address.vo';
import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';
import { Customer } from '../../../domain/identity/entities/Customer';
import { IUserRepository } from '../../../domain/identity/repositories/IUserRepository';
import { ICustomerRepository } from '../../../domain/identity/repositories/ICustomerRepository';
import { IPasswordHasher } from '../../../domain/identity/services/IPasswordHasher';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IEventBus } from '../../shared/events/IEventBus';
import { RegisterCustomerDto } from '../dtos/RegisterCustomerDto';
import { AuthResponse } from '../responses/AuthResponse';
import { toAuthResponse } from '../responses/mappers';

export class RegisterCustomer {
  constructor(
    private userRepo: IUserRepository,
    private customerRepo: ICustomerRepository,
    private passwordHasher: IPasswordHasher,
    private unitOfWork: IUnitOfWork,
    private eventBus: IEventBus,
  ) {}

  async execute(dto: RegisterCustomerDto): Promise<Result<AuthResponse>> {
    const emailResult = Email.create(dto.email);
    if (emailResult.isFailure) return Result.fail(emailResult.getError());
    const email = emailResult.getValue();

    const passwordResult = Password.create(dto.password);
    if (passwordResult.isFailure) return Result.fail(passwordResult.getError());

    const exists = await this.userRepo.existsByEmail(email);
    if (exists) return Result.fail(new ConflictError('email_already_registered'));

    let referralCode: string | undefined;
    if (dto.referralCode) {
      const referrer = await this.customerRepo.findByReferralCode(dto.referralCode);
      if (referrer) {
        referralCode = dto.referralCode;
      }
    }

    const passwordHash = await this.passwordHasher.hash(dto.password);

    let defaultAddress: Address | undefined;
    if (dto.address) {
      const geoResult = GeoPoint.create(dto.address.lat, dto.address.lng);
      if (geoResult.isFailure) return Result.fail(geoResult.getError());

      const addressResult = Address.create({
        street: dto.address.street,
        city: dto.address.city,
        state: dto.address.state,
        pinCode: dto.address.pinCode,
        coordinates: geoResult.getValue(),
        label: dto.address.label,
      });
      if (addressResult.isFailure) return Result.fail(addressResult.getError());
      defaultAddress = addressResult.getValue();
    }

    const newCustomerReferralCode = randomUUID().slice(0, 8).toUpperCase();
    const createInput = {
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      referralCode: newCustomerReferralCode,
      ...(defaultAddress ? { defaultAddress } : {}),
    };
    const customer = Customer.create(createInput);
    if (referralCode) {
      customer.referredBy = referralCode;
    }

    const events = customer.pullDomainEvents();

    await this.unitOfWork.runInTransaction(async () => {
      await this.userRepo.save(customer);
    });

    await this.eventBus.publishAll(events);

    return Result.ok(toAuthResponse(customer, '', '', 0));
  }
}
