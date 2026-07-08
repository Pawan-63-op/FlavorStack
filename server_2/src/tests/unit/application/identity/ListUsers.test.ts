import { ListUsers } from '../../../../application/identity/use-cases/ListUsers';
import { InMemoryUserRepository } from '../../../mocks/identity.mocks';
import { Customer } from '../../../../domain/identity/entities/Customer';
import { Admin } from '../../../../domain/identity/entities/Admin';
import { USER_ROLE } from '../../../../domain/identity/enums/user-role.enum';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';

function makeCustomer(email: string, name = 'Test User'): Customer {
  const c = Customer.create({
    name,
    email,
    phone: '+919876543210',
    passwordHash: 'hashed:Password1!',
    referralCode: 'REF00001',
  });
  c.pullDomainEvents();
  return c;
}

function makeAdmin(email: string): Admin {
  const a = Admin.createSuperAdmin({
    name: 'Admin User',
    email,
    phone: '+919876543212',
    passwordHash: 'hashedpassword123',
    department: 'Operations',
  });
  a.pullDomainEvents();
  return a;
}

describe('ListUsers use-case', () => {
  let userRepo: InMemoryUserRepository;
  let useCase: ListUsers;

  beforeEach(async () => {
    userRepo = new InMemoryUserRepository();
    useCase = new ListUsers(userRepo);
    await userRepo.save(makeCustomer('a@example.com', 'Alice'));
    await userRepo.save(makeCustomer('b@example.com', 'Bob'));
    await userRepo.save(makeAdmin('admin@example.com'));
  });

  it('returns paginated summaries with the total count', async () => {
    const result = await useCase.execute({ limit: 10, offset: 0 });

    expect(result.isSuccess).toBe(true);
    const value = result.getValue();
    expect(value.total).toBe(3);
    expect(value.users).toHaveLength(3);
    expect(value.users[0]).toMatchObject({
      email: expect.any(String),
      role: expect.any(String),
      isBanned: false,
      isActive: true,
    });
  });

  it('filters by role', async () => {
    const result = await useCase.execute({ limit: 10, offset: 0, role: USER_ROLE.ADMIN });

    const value = result.getValue();
    expect(value.total).toBe(1);
    expect(value.users.map((u) => u.role)).toEqual([USER_ROLE.ADMIN]);
  });

  it('filters by search across name/email (case-insensitive)', async () => {
    const result = await useCase.execute({ limit: 10, offset: 0, search: 'alice' });

    const value = result.getValue();
    expect(value.total).toBe(1);
    expect(value.users[0].name).toBe('Alice');
  });

  it('honors limit/offset paging', async () => {
    const page1 = (await useCase.execute({ limit: 2, offset: 0 })).getValue();
    const page2 = (await useCase.execute({ limit: 2, offset: 2 })).getValue();

    expect(page1.users).toHaveLength(2);
    expect(page2.users).toHaveLength(1);
    expect(page1.total).toBe(3);
  });

  it('rejects an unknown role with a ValidationError', async () => {
    const result = await useCase.execute({ limit: 10, offset: 0, role: 'WIZARD' });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });
});
