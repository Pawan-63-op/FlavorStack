import { Customer } from '../entities/Customer';

export interface ICustomerRepository {
  findByReferralCode(code: string): Promise<Customer | null>;
}
