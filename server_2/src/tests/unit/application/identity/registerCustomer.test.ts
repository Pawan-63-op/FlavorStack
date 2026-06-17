import { RegisterCustomer } from '../../../../application/identity/use-cases/RegisterCustomer';
import { RegisterCustomerDto } from '../../../../application/identity/dtos/RegisterCustomerDto';
import {
  InMemoryUserRepository,
  InMemoryCustomerRepository,
  FakePasswordHasher,
  InMemoryUnitOfWork,
  InMemoryOutboxStore,
} from '../../../mocks/identity.mocks';
import { createEventBusSpy } from '../../../mocks/shared.mocks';
import { Customer } from '../../../../domain/identity/entities/Customer';
import { ConflictError } from '../../../../domain/shared/errors/ConflictError';
import { DomainError } from '../../../../domain/shared/errors/DomainError';

describe('RegisterCustomer use-case', () => {
  let userRepo: InMemoryUserRepository;
  let customerRepo: InMemoryCustomerRepository;
  let passwordHasher: FakePasswordHasher;
  let unitOfWork: InMemoryUnitOfWork;
  let outboxStore: InMemoryOutboxStore;
  let eventBus: ReturnType<typeof createEventBusSpy>;
  let useCase: RegisterCustomer;

  const validDto: RegisterCustomerDto = {
    name: 'Alice Smith',
    email: 'alice@example.com',
    phone: '+919876543210',
    password: 'Password1!',
  };

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    customerRepo = new InMemoryCustomerRepository(userRepo);
    passwordHasher = new FakePasswordHasher();
    unitOfWork = new InMemoryUnitOfWork();
    outboxStore = new InMemoryOutboxStore();
    eventBus = createEventBusSpy();
    useCase = new RegisterCustomer(
      userRepo,
      customerRepo,
      passwordHasher,
      unitOfWork,
      outboxStore,
      eventBus,
    );
  });

  describe('success', () => {
    it('returns ok with empty tokens (email not verified)', async () => {
      const result = await useCase.execute(validDto);
      expect(result.isSuccess).toBe(true);
      const auth = result.getValue();
      expect(auth.accessToken).toBe('');
      expect(auth.refreshToken).toBe('');
      expect(auth.expiresIn).toBe(0);
    });

    it('returns user response with correct fields', async () => {
      const result = await useCase.execute(validDto);
      const user = result.getValue().user;
      expect(user.name).toBe(validDto.name);
      expect(user.email).toBe(validDto.email);
      expect(user.role).toBe('CUSTOMER');
      expect(user.isEmailVerified).toBe(false);
    });

    it('saves customer to repo', async () => {
      await useCase.execute(validDto);
      const saved = Array.from(userRepo.users.values())[0];
      expect(saved).toBeInstanceOf(Customer);
      expect((saved as Customer).email).toBe(validDto.email);
    });

    it('appends UserRegistered to outbox', async () => {
      await useCase.execute(validDto);
      expect(outboxStore.appended.length).toBe(1);
      expect(outboxStore.appended[0].eventName).toBe('UserRegistered');
    });

    it('publishes UserRegistered via event bus', async () => {
      await useCase.execute(validDto);
      expect(eventBus.publishedEvents.length).toBe(1);
      expect(eventBus.publishedEvents[0].eventName).toBe('UserRegistered');
    });

    it('commits the unit of work', async () => {
      await useCase.execute(validDto);
      expect(unitOfWork.committed).toBe(true);
    });

    it('hashes the password before persisting', async () => {
      await useCase.execute(validDto);
      const saved = Array.from(userRepo.users.values())[0];
      expect(saved.passwordHash).toBe(`hashed:${validDto.password}`);
    });

    it('builds address VO when address is provided', async () => {
      const dtoWithAddress: RegisterCustomerDto = {
        ...validDto,
        address: {
          street: '123 Main St',
          city: 'Mumbai',
          state: 'Maharashtra',
          pinCode: '400001',
          lat: 19.076,
          lng: 72.877,
          label: 'Home',
        },
      };
      const result = await useCase.execute(dtoWithAddress);
      expect(result.isSuccess).toBe(true);
      const saved = Array.from(userRepo.users.values())[0] as Customer;
      expect(saved.addresses.length).toBe(1);
    });

    it('silently ignores invalid referral code', async () => {
      const dto: RegisterCustomerDto = { ...validDto, referralCode: 'NONEXISTENT' };
      const result = await useCase.execute(dto);
      expect(result.isSuccess).toBe(true);
    });

    it('applies referral code if a matching customer exists', async () => {
      // Seed a referrer
      const referrer = Customer.create({
        name: 'Referrer',
        email: 'ref@example.com',
        phone: '+919999999999',
        passwordHash: 'hashed:Password1!',
        referralCode: 'MYCODE01',
      });
      referrer.pullDomainEvents(); // clear events
      userRepo.users.set(referrer._id, referrer);

      const dto: RegisterCustomerDto = { ...validDto, referralCode: 'MYCODE01' };
      const result = await useCase.execute(dto);
      expect(result.isSuccess).toBe(true);
      // The new customer's referredBy should be set
      const saved = Array.from(userRepo.users.values()).find(
        (u) => u.email === validDto.email,
      ) as Customer;
      expect(saved.referredBy).toBe('MYCODE01');
    });
  });

  describe('failure paths', () => {
    it('fails with validation error on invalid email', async () => {
      const result = await useCase.execute({ ...validDto, email: 'not-an-email' });
      expect(result.isFailure).toBe(true);
    });

    it('fails with validation error on weak password', async () => {
      const result = await useCase.execute({ ...validDto, password: 'weak' });
      expect(result.isFailure).toBe(true);
    });

    it('fails with ConflictError when email already exists', async () => {
      // First registration
      await useCase.execute(validDto);
      // Second registration with same email
      const result = await useCase.execute(validDto);
      expect(result.isFailure).toBe(true);
      const err = result.getError() as DomainError;
      expect(err).toBeInstanceOf(ConflictError);
      expect(err.message).toBe('email_already_registered');
    });

    it('fails with validation error on invalid address coordinates', async () => {
      const dto: RegisterCustomerDto = {
        ...validDto,
        email: 'new2@example.com',
        address: {
          street: '123 Main St',
          city: 'Mumbai',
          state: 'Maharashtra',
          pinCode: '400001',
          lat: 999, // invalid
          lng: 72.877,
        },
      };
      const result = await useCase.execute(dto);
      expect(result.isFailure).toBe(true);
    });
  });
});
