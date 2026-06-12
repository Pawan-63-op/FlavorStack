// Transactional unit of work backed by a MongoDB multi-document transaction.
//
// `runInTransaction(work)`:
//   1. opens a ClientSession on the Mongoose connection,
//   2. binds it to the shared TransactionContext (AsyncLocalStorage) for the
//      duration of the work, so repositories and the outbox store implicitly
//      attach the same session,
//   3. runs `work` inside `session.withTransaction(...)` — committing on success,
//      aborting on any thrown error (the driver also retries transient txn errors),
//   4. always ends the session.
//
// The `ctx` handed to `work` IS the ClientSession, so `outboxStore.append(events,
// ctx)` (which takes an explicit ctx) and a repository's `save` (which reads the
// session from TransactionContext) operate on the same transaction.
//
// Requires a replica set — standalone mongod rejects transactions.
import type { ClientSession, Connection } from 'mongoose';
import { IUnitOfWork } from '../../application/shared/ports/IUnitOfWork';
import { TransactionContext } from './TransactionContext';

export class MongoUnitOfWork implements IUnitOfWork {
  constructor(
    private readonly connection: Connection,
    private readonly txContext: TransactionContext,
  ) {}

  async runInTransaction<T>(work: (ctx: ClientSession) => Promise<T>): Promise<T> {
    const session = await this.connection.startSession();
    try {
      return await this.txContext.run(session, () =>
        session.withTransaction(() => work(session)),
      );
    } finally {
      await session.endSession();
    }
  }
}
