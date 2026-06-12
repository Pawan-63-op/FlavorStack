// MongoDB implementation of ICustomerRepository (Phase 6, Batch 5).
//
// Adds the Customer-specific finder on top of the shared `users` collection.
// Writes go through MongoUserRepository (IUserRepository.save/update) — this
// repository only adds queries, reusing CustomerModel + CustomerMapper from
// Batch 1/2.
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
