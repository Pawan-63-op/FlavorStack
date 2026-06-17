import type { Connection } from 'mongoose';
import { createIdentityContainer } from '../../../container/identity.container';
import { MongoUserRepository } from '../../../infrastructure/repositories/UserRepository';
import { MongoCustomerRepository } from '../../../infrastructure/repositories/CustomerRepository';
import { MongoDriverRepository } from '../../../infrastructure/repositories/DriverRepository';
import { MongoAdminRepository } from '../../../infrastructure/repositories/AdminRepository';
import { MongoUnitOfWork } from '../../../infrastructure/database/MongoUnitOfWork';
import { MongoOutboxStore } from '../../../infrastructure/database/MongoOutboxStore';
import { MongoOutboxRepository } from '../../../infrastructure/repositories/OutboxRepository';

function fakeConnection(): Connection {
  return {} as unknown as Connection;
}

describe('createIdentityContainer', () => {
  it('returns concrete implementations satisfying every IdentityContainer field', () => {
    const container = createIdentityContainer(fakeConnection());

    expect(container.userRepository).toBeInstanceOf(MongoUserRepository);
    expect(container.customerRepository).toBeInstanceOf(MongoCustomerRepository);
    expect(container.driverRepository).toBeInstanceOf(MongoDriverRepository);
    expect(container.adminRepository).toBeInstanceOf(MongoAdminRepository);
    expect(container.unitOfWork).toBeInstanceOf(MongoUnitOfWork);
    expect(container.outboxStore).toBeInstanceOf(MongoOutboxStore);
    expect(container.outboxRepository).toBeInstanceOf(MongoOutboxRepository);
  });

  it('shares exactly one TransactionContext across all seven constructed components', () => {
    const container = createIdentityContainer(fakeConnection());

    const components = [
      container.userRepository,
      container.customerRepository,
      container.driverRepository,
      container.adminRepository,
      container.unitOfWork,
      container.outboxStore,
      container.outboxRepository,
    ];

    const txContexts = components.map((c) => (c as unknown as { txContext: unknown }).txContext);

    const [first, ...rest] = txContexts;
    expect(first).toBeDefined();
    rest.forEach((tx) => expect(tx).toBe(first));
  });
});
