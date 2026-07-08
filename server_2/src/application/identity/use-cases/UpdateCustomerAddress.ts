import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../domain/shared/errors/ForbiddenError';
import { IUserRepository } from '../../../domain/identity/repositories/IUserRepository';
import { Customer } from '../../../domain/identity/entities/Customer';
import { UpdateAddressDto } from '../dtos/AddressDtos';
import { AddressResponse } from '../responses/AddressResponse';
import { toAddressListResponse } from '../responses/addressMappers';
import { buildAddressFromInput } from './buildAddressFromInput';

export class UpdateCustomerAddress {
  constructor(private userRepo: IUserRepository) {}

  async execute(dto: UpdateAddressDto): Promise<Result<AddressResponse[]>> {
    const user = await this.userRepo.findById(dto.userId);
    if (!user) return Result.fail(new NotFoundError('user_not_found'));
    if (!(user instanceof Customer)) {
      return Result.fail(new ForbiddenError('addresses_customer_only'));
    }

    const exists = user.addresses.some((a) => a.id === dto.addressId);
    if (!exists) return Result.fail(new NotFoundError('address_not_found'));

    const addr = buildAddressFromInput(dto);
    if (addr.isFailure) return Result.fail(addr.getError());

    user.updateAddress(dto.addressId, addr.getValue());
    if (dto.isDefault) user.setDefaultAddress(dto.addressId);

    await this.userRepo.update(user);
    return Result.ok(toAddressListResponse(user));
  }
}
