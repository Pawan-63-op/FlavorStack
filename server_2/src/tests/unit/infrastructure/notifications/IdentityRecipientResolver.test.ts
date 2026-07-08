import { IdentityRecipientResolver } from '../../../../infrastructure/notifications/IdentityRecipientResolver';
import { IUserRepository } from '../../../../domain/identity/repositories/IUserRepository';
import { Customer } from '../../../../domain/identity/entities/Customer';
import { Admin } from '../../../../domain/identity/entities/Admin';
import { BaseUser } from '../../../../domain/identity/entities/BaseUser';
import { Email } from '../../../../domain/identity/value-objects/Email.vo';

function makeUserRepo(findByIdImpl: IUserRepository['findById']): jest.Mocked<IUserRepository> {
  return {
    save: jest.fn(async (_u: BaseUser) => {}),
    update: jest.fn(async (_u: BaseUser) => {}),
    softDelete: jest.fn(async (_id: string) => {}),
    findById: jest.fn(findByIdImpl),
    findByEmail: jest.fn(async (_email: Email) => null),
    existsByEmail: jest.fn(async (_email: Email) => false),
  };
}

function buildCustomer(over: Partial<Customer> = {}): Customer {
  return new Customer({ name: 'Alice', email: 'alice@example.com', fcmTokens: [], ...over });
}

describe('IdentityRecipientResolver.resolveEmail', () => {
  it("returns the user's email when found", async () => {
    const customer = buildCustomer();
    const resolver = new IdentityRecipientResolver(makeUserRepo(async () => customer));

    await expect(resolver.resolveEmail('user-1')).resolves.toBe('alice@example.com');
  });

  it('returns null when the user is not found', async () => {
    const resolver = new IdentityRecipientResolver(makeUserRepo(async () => null));

    await expect(resolver.resolveEmail('missing')).resolves.toBeNull();
  });
});

describe('IdentityRecipientResolver.resolvePushTokens', () => {
  it("returns the customer's fcm tokens", async () => {
    const customer = buildCustomer();
    customer.registerFcmToken('tok-a');
    customer.registerFcmToken('tok-b');
    const resolver = new IdentityRecipientResolver(makeUserRepo(async () => customer));

    await expect(resolver.resolvePushTokens('user-1')).resolves.toEqual(['tok-a', 'tok-b']);
  });

  it('returns an empty array when the user is not found', async () => {
    const resolver = new IdentityRecipientResolver(makeUserRepo(async () => null));

    await expect(resolver.resolvePushTokens('missing')).resolves.toEqual([]);
  });

  it('returns an empty array for a non-customer user (no device tokens)', async () => {
    const admin = new Admin({ name: 'Root', email: 'root@example.com' });
    const resolver = new IdentityRecipientResolver(makeUserRepo(async () => admin));

    await expect(resolver.resolvePushTokens('admin-1')).resolves.toEqual([]);
  });
});
