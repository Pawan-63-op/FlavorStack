// AsyncLocalStorage-based provider for the active Mongo transaction session.
//
// `MongoUnitOfWork` opens a session, then runs the unit-of-work callback inside
// `run(session, fn)`. Any repository or outbox store executing within that async
// call tree reads the same session via `getSession()` and attaches it to its
// Mongoose operations — so the user write and the outbox append land in the same
// transaction WITHOUT threading a `ctx` parameter through the repository
// interfaces (Phase-4/Phase-5 contracts stay frozen).
//
// Outside a transaction `getSession()` returns `undefined`, and operations run
// against the connection's default (auto-committed) session.
import { AsyncLocalStorage } from 'async_hooks';
import type { ClientSession } from 'mongoose';

interface TransactionStore {
  session: ClientSession;
}

export class TransactionContext {
  private readonly storage = new AsyncLocalStorage<TransactionStore>();

  /** The session bound to the current async context, or undefined if none. */
  getSession(): ClientSession | undefined {
    return this.storage.getStore()?.session;
  }

  /** Run `fn` with `session` bound to the async context for its entire duration. */
  run<T>(session: ClientSession, fn: () => Promise<T>): Promise<T> {
    return this.storage.run({ session }, fn);
  }
}
