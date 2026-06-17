import { RegisterDriver } from '../../../../application/identity/use-cases/RegisterDriver';
import { RegisterDriverDto } from '../../../../application/identity/dtos/RegisterDriverDto';
import {
  InMemoryUserRepository,
  FakePasswordHasher,
  InMemoryUnitOfWork,
  InMemoryOutboxStore,
} from '../../../mocks/identity.mocks';
import { createEventBusSpy } from '../../../mocks/shared.mocks';
import { Driver } from '../../../../domain/identity/entities/Driver';
import { ConflictError } from '../../../../domain/shared/errors/ConflictError';
import { DomainError } from '../../../../domain/shared/errors/DomainError';

describe('RegisterDriver use-case', () => {
  let userRepo: InMemoryUserRepository;
  let passwordHasher: FakePasswordHasher;
  let unitOfWork: InMemoryUnitOfWork;
  let outboxStore: InMemoryOutboxStore;
  let eventBus: ReturnType<typeof createEventBusSpy>;
  let useCase: RegisterDriver;

  const validDto: RegisterDriverDto = {
    name: 'Bob Driver',
    email: 'bob@example.com',
    phone: '+919876543211',
    password: 'Password1!',
    vehicle: {
      type: 'Motorcycle',
      brand: 'Honda',
      model: 'CB300R',
      licensePlate: 'MH12AB1234',
      rcDocumentUrl: 'https://example.com/rc.pdf',
      insuranceUrl: 'https://example.com/insurance.pdf',
    },
  };

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    passwordHasher = new FakePasswordHasher();
    unitOfWork = new InMemoryUnitOfWork();
    outboxStore = new InMemoryOutboxStore();
    eventBus = createEventBusSpy();
    useCase = new RegisterDriver(userRepo, passwordHasher, unitOfWork, outboxStore, eventBus);
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
      expect(user.role).toBe('DRIVER');
      expect(user.isEmailVerified).toBe(false);
    });

    it('saves driver to repo', async () => {
      await useCase.execute(validDto);
      const saved = Array.from(userRepo.users.values())[0];
      expect(saved).toBeInstanceOf(Driver);
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
  });

  describe('failure paths', () => {
    it('fails on invalid email', async () => {
      const result = await useCase.execute({ ...validDto, email: 'bad-email' });
      expect(result.isFailure).toBe(true);
    });

    it('fails on weak password', async () => {
      const result = await useCase.execute({ ...validDto, password: 'weak' });
      expect(result.isFailure).toBe(true);
    });

    it('fails with ConflictError on duplicate email', async () => {
      await useCase.execute(validDto);
      const result = await useCase.execute(validDto);
      expect(result.isFailure).toBe(true);
      const err = result.getError() as DomainError;
      expect(err).toBeInstanceOf(ConflictError);
      expect(err.message).toBe('email_already_registered');
    });

    it('fails with validation error on invalid vehicle info', async () => {
      const result = await useCase.execute({
        ...validDto,
        email: 'new@example.com',
        vehicle: {
          ...validDto.vehicle,
          licensePlate: '', // empty — invalid
        },
      });
      expect(result.isFailure).toBe(true);
    });

    it('fails with validation error on invalid RC document URL', async () => {
      const result = await useCase.execute({
        ...validDto,
        email: 'new2@example.com',
        vehicle: {
          ...validDto.vehicle,
          rcDocumentUrl: 'not-a-url',
        },
      });
      expect(result.isFailure).toBe(true);
    });
  });
});
