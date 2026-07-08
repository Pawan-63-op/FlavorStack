import type { ClientSession } from 'mongoose';
import { ICustomerRepository } from '../../domain/identity/repositories/ICustomerRepository';
import { Customer } from '../../domain/identity/entities/Customer';
import { TransactionContext } from '../database/TransactionContext';
import { CustomerModel, CustomerDocument } from '../database/models/CustomerModel';
import { CustomerMapper } from '../database/mappers/CustomerMapper';

export class MongoCustomerRepository implements ICustomerRepository {
  constructor(private readonly txContext: TransactionContext) {}

  private get session(): ClientSession | undefined {
    return this.txContext.getSession();
  }

  async findByReferralCode(code: string): Promise<Customer | null> {
    const doc = await CustomerModel.findOne({ referralCode: code, deletedAt: null }, null, {
      session: this.session,
    }).lean<CustomerDocument>();
    return doc ? CustomerMapper.toDomain(doc) : null;
  }
}
