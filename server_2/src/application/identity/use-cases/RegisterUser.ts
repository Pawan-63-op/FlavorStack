import { Result } from '../../../domain/shared/Result';
import { ValidationError } from '../../../domain/shared/errors/ValidationError';
import { USER_ROLE } from '../../../domain/identity/enums/user-role.enum';
import { RegisterUserDto } from '../dtos/RegisterUserDto';
import { AuthResponse } from '../responses/AuthResponse';
import { RegisterCustomer } from './RegisterCustomer';
import { RegisterDriver } from './RegisterDriver';

export class RegisterUser {
  constructor(
    private registerCustomer: RegisterCustomer,
    private registerDriver: RegisterDriver,
  ) {}

  async execute(dto: RegisterUserDto): Promise<Result<AuthResponse>> {
    if (dto.role === USER_ROLE.CUSTOMER) {
      if (!dto.customer) return Result.fail(new ValidationError('customer_data_required'));
      return this.registerCustomer.execute(dto.customer);
    }

    if (dto.role === USER_ROLE.DRIVER) {
      if (!dto.driver) return Result.fail(new ValidationError('driver_data_required'));
      return this.registerDriver.execute(dto.driver);
    }

    return Result.fail(new ValidationError('unsupported_role'));
  }
}
