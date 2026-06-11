// Composition root for Identity repository and persistence-port interfaces (Phase 9, Batch 2).
import type { Connection } from 'mongoose';
import { IUserRepository } from '../domain/identity/repositories/IUserRepository';
import { ICustomerRepository } from '../domain/identity/repositories/ICustomerRepository';
import { IDriverRepository } from '../domain/identity/repositories/IDriverRepository';
import { IAdminRepository } from '../domain/identity/repositories/IAdminRepository';
import { IUnitOfWork } from '../application/shared/ports/IUnitOfWork';
import { IOutboxStore } from '../application/shared/outbox/IOutboxStore';
import { MongoUserRepository } from '../infrastructure/repositories/UserRepository';
import { MongoCustomerRepository } from '../infrastructure/repositories/CustomerRepository';
import { MongoDriverRepository } from '../infrastructure/repositories/DriverRepository';
import { MongoAdminRepository } from '../infrastructure/repositories/AdminRepository';
import { MongoUnitOfWork } from '../infrastructure/database/MongoUnitOfWork';
import { MongoOutboxStore } from '../infrastructure/database/MongoOutboxStore';
import { MongoOutboxRepository } from '../infrastructure/repositories/OutboxRepository';
import { TransactionContext } from '../infrastructure/database/TransactionContext';

export interface IdentityContainer {
  userRepository: IUserRepository;
  customerRepository: ICustomerRepository;
  driverRepository: IDriverRepository;
  adminRepository: IAdminRepository;
  unitOfWork: IUnitOfWork;
  outboxStore: IOutboxStore;
  outboxRepository: MongoOutboxRepository;
}

/**
 * Wires every Identity repository interface and persistence port to its Mongo
 * implementation. All seven components share a single `TransactionContext` so
 * `unitOfWork.runInTransaction(...)` transparently propagates its session to
 * the repositories and the outbox store/repository constructed here.
 */
export function createIdentityContainer(connection: Connection): IdentityContainer {
  const txContext = new TransactionContext();

  return {
    userRepository: new MongoUserRepository(txContext),
    customerRepository: new MongoCustomerRepository(txContext),
    driverRepository: new MongoDriverRepository(txContext),
    adminRepository: new MongoAdminRepository(txContext),
    unitOfWork: new MongoUnitOfWork(connection, txContext),
    outboxStore: new MongoOutboxStore(txContext),
    outboxRepository: new MongoOutboxRepository(txContext),
  };
}
