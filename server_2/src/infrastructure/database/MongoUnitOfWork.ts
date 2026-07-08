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
