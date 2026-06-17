import { UpdateProfile } from '../../../../application/identity/use-cases/UpdateProfile';
import { InMemoryUserRepository } from '../../../mocks/identity.mocks';
import { Customer } from '../../../../domain/identity/entities/Customer';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';

function makeCustomer(): Customer {
  const customer = Customer.create({
    name: 'Original Name',
    email: 'user@example.com',
    phone: '+919876543210',
    passwordHash: 'hashed:Password1!',
    referralCode: 'REF00001',
  });
  customer.pullDomainEvents();
  return customer;
}

describe('UpdateProfile use-case', () => {
  let userRepo: InMemoryUserRepository;
  let useCase: UpdateProfile;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    useCase = new UpdateProfile(userRepo);
  });

  describe('success', () => {
    it('updates name and avatarUrl and persists the change', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);

      const result = await useCase.execute({
        userId: customer._id,
        name: 'New Name',
        avatarUrl: 'https://example.com/avatar.png',
      });

      expect(result.isSuccess).toBe(true);
      expect(result.getValue().name).toBe('New Name');
      expect(result.getValue().avatarUrl).toBe('https://example.com/avatar.png');

      const persisted = await userRepo.findById(customer._id);
      expect(persisted!.name).toBe('New Name');
      expect(persisted!.avatarUrl).toBe('https://example.com/avatar.png');
    });

    it('leaves fields unchanged when not provided in the dto', async () => {
      const customer = makeCustomer();
      customer.avatarUrl = 'https://example.com/old.png';
      await userRepo.save(customer);

      const result = await useCase.execute({ userId: customer._id, name: 'Only Name Changed' });

      expect(result.isSuccess).toBe(true);
      expect(result.getValue().name).toBe('Only Name Changed');
      expect(result.getValue().avatarUrl).toBe('https://example.com/old.png');
    });
  });

  describe('failure paths', () => {
    it('fails with NotFoundError for unknown user', async () => {
      const result = await useCase.execute({ userId: 'does-not-exist', name: 'New Name' });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(NotFoundError);
    });
  });
});
