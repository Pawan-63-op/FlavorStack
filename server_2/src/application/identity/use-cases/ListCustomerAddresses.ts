import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../domain/shared/errors/ForbiddenError';
import { IUserRepository } from '../../../domain/identity/repositories/IUserRepository';
import { Customer } from '../../../domain/identity/entities/Customer';
import { ListAddressesDto } from '../dtos/AddressDtos';
import { AddressResponse } from '../responses/AddressResponse';
import { toAddressListResponse } from '../responses/addressMappers';

export class ListCustomerAddresses {
  constructor(private userRepo: IUserRepository) {}

  async execute(dto: ListAddressesDto): Promise<Result<AddressResponse[]>> {
    const user = await this.userRepo.findById(dto.userId);
    if (!user) return Result.fail(new NotFoundError('user_not_found'));
    if (!(user instanceof Customer)) {
      return Result.fail(new ForbiddenError('addresses_customer_only'));
    }
    return Result.ok(toAddressListResponse(user));
  }
}
