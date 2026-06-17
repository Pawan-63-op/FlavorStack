import { GetProfile } from '../../../../application/identity/use-cases/GetProfile';
import { InMemoryUserRepository } from '../../../mocks/identity.mocks';
import { Customer } from '../../../../domain/identity/entities/Customer';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';

function makeCustomer(): Customer {
  const customer = Customer.create({
    name: 'Test User',
    email: 'user@example.com',
    phone: '+919876543210',
    passwordHash: 'hashed:Password1!',
    referralCode: 'REF00001',
  });
  customer.pullDomainEvents();
  return customer;
}

describe('GetProfile use-case', () => {
  let userRepo: InMemoryUserRepository;
  let useCase: GetProfile;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    useCase = new GetProfile(userRepo);
  });

  describe('success', () => {
    it('returns the user profile mapped via toUserResponse', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);

      const result = await useCase.execute({ userId: customer._id });

      expect(result.isSuccess).toBe(true);
      expect(result.getValue()).toEqual({
        id: customer._id,
        name: customer.name,
        email: customer.email,
        role: customer.role,
        isEmailVerified: customer.isEmailVerified,
        avatarUrl: customer.avatarUrl || undefined,
        createdAt: customer.createdAt,
      });
    });
  });

  describe('failure paths', () => {
    it('fails with NotFoundError for unknown user', async () => {
      const result = await useCase.execute({ userId: 'does-not-exist' });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(NotFoundError);
    });
  });
});
