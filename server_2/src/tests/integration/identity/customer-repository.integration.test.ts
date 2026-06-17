import { Customer } from '../../../domain/identity/entities/Customer';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoUserRepository } from '../../../infrastructure/repositories/UserRepository';
import { MongoCustomerRepository } from '../../../infrastructure/repositories/CustomerRepository';
import { UserModel } from '../../../infrastructure/database/models/UserModel';
import { buildCustomer } from './identity-fixtures';

describe('MongoCustomerRepository', () => {
  let txContext: TransactionContext;
  let userRepo: MongoUserRepository;
  let repo: MongoCustomerRepository;

  beforeEach(() => {
    txContext = new TransactionContext();
    userRepo = new MongoUserRepository(txContext);
    repo = new MongoCustomerRepository(txContext);
  });

  afterEach(async () => {
    await UserModel.deleteMany({});
  });

  describe('findByReferralCode', () => {
    it('finds the customer that owns the referral code', async () => {
      const original = buildCustomer({ referralCode: 'REF12345' });
      await userRepo.save(original);

      const found = await repo.findByReferralCode('REF12345');

      expect(found).toBeInstanceOf(Customer);
      expect(found?._id).toBe(original._id);
      expect(found?.referralCode).toBe('REF12345');
      expect(found?.pullDomainEvents()).toEqual([]);
    });

    it('returns null when no customer owns the referral code', async () => {
      expect(await repo.findByReferralCode('NOPE0000')).toBeNull();
    });

    it('does not return a soft-deleted customer', async () => {
      const original = buildCustomer({ referralCode: 'DELETED1' });
      await userRepo.save(original);
      await userRepo.softDelete(original._id);

      expect(await repo.findByReferralCode('DELETED1')).toBeNull();
    });
  });
});
