import { ICustomerAddressDirectory } from '../../application/commerce/ports/ICustomerAddressDirectory';
import { IUserRepository } from '../../domain/identity/repositories/IUserRepository';
import { Customer } from '../../domain/identity/entities/Customer';
import { Address } from '../../domain/identity/value-objects/Address.vo';

/** `ICustomerAddressDirectory` over the Identity user repository. */
export class IdentityCustomerAddressDirectory implements ICustomerAddressDirectory {
  constructor(private readonly userRepo: IUserRepository) {}

  async getAddress(customerId: string, addressId: string): Promise<Address | null> {
    const user = await this.userRepo.findById(customerId);
    if (!(user instanceof Customer)) return null;
    const entry = user.addresses.find((a) => a.id === addressId);
    return entry ? entry.address : null;
  }
}
