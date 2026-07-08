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
