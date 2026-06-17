import { RegisterUser } from '../../../../application/identity/use-cases/RegisterUser';
import { RegisterCustomer } from '../../../../application/identity/use-cases/RegisterCustomer';
import { RegisterDriver } from '../../../../application/identity/use-cases/RegisterDriver';
import { RegisterUserDto } from '../../../../application/identity/dtos/RegisterUserDto';
import { USER_ROLE } from '../../../../domain/identity/enums/user-role.enum';
import {
  InMemoryUserRepository,
  InMemoryCustomerRepository,
  FakePasswordHasher,
  InMemoryUnitOfWork,
  InMemoryOutboxStore,
} from '../../../mocks/identity.mocks';
import { createEventBusSpy } from '../../../mocks/shared.mocks';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';
import { DomainError } from '../../../../domain/shared/errors/DomainError';

describe('RegisterUser use-case (thin dispatcher)', () => {
  let userRepo: InMemoryUserRepository;
  let customerRepo: InMemoryCustomerRepository;
  let passwordHasher: FakePasswordHasher;
  let unitOfWork: InMemoryUnitOfWork;
  let outboxStore: InMemoryOutboxStore;
  let useCase: RegisterUser;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    customerRepo = new InMemoryCustomerRepository(userRepo);
    passwordHasher = new FakePasswordHasher();
    unitOfWork = new InMemoryUnitOfWork();
    outboxStore = new InMemoryOutboxStore();
    const eventBus = createEventBusSpy();

    const registerCustomer = new RegisterCustomer(
      userRepo,
      customerRepo,
      passwordHasher,
      unitOfWork,
      outboxStore,
      eventBus,
    );
    const registerDriver = new RegisterDriver(
      userRepo,
      passwordHasher,
      unitOfWork,
      outboxStore,
      eventBus,
    );
    useCase = new RegisterUser(registerCustomer, registerDriver);
  });

  it('delegates to RegisterCustomer when role is CUSTOMER', async () => {
    const dto: RegisterUserDto = {
      role: USER_ROLE.CUSTOMER,
      customer: {
        name: 'Customer A',
        email: 'customer@example.com',
        phone: '+919876543210',
        password: 'Password1!',
      },
    };
    const result = await useCase.execute(dto);
    expect(result.isSuccess).toBe(true);
    expect(result.getValue().user.role).toBe('CUSTOMER');
  });

  it('delegates to RegisterDriver when role is DRIVER', async () => {
    const dto: RegisterUserDto = {
      role: USER_ROLE.DRIVER,
      driver: {
        name: 'Driver B',
        email: 'driver@example.com',
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
      },
    };
    const result = await useCase.execute(dto);
    expect(result.isSuccess).toBe(true);
    expect(result.getValue().user.role).toBe('DRIVER');
  });

  it('fails with ValidationError when CUSTOMER role but no customer data', async () => {
    const dto: RegisterUserDto = { role: USER_ROLE.CUSTOMER };
    const result = await useCase.execute(dto);
    expect(result.isFailure).toBe(true);
    const err = result.getError() as DomainError;
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toBe('customer_data_required');
  });

  it('fails with ValidationError when DRIVER role but no driver data', async () => {
    const dto: RegisterUserDto = { role: USER_ROLE.DRIVER };
    const result = await useCase.execute(dto);
    expect(result.isFailure).toBe(true);
    const err = result.getError() as DomainError;
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toBe('driver_data_required');
  });

  it('fails with ValidationError for unsupported role', async () => {
    const dto = { role: 'ADMIN' as any };
    const result = await useCase.execute(dto);
    expect(result.isFailure).toBe(true);
    const err = result.getError() as DomainError;
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toBe('unsupported_role');
  });
});
