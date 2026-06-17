import type { ClientSession } from 'mongoose';
import { TransactionContext } from '../../../../infrastructure/database/TransactionContext';

// A bare stand-in for a Mongo ClientSession — the ALS provider never inspects
// the object, it only stores and returns it, so an opaque token is enough.
function fakeSession(tag: string): ClientSession {
  return { tag } as unknown as ClientSession;
}

describe('TransactionContext', () => {
  it('returns undefined when no transaction is active', () => {
    const ctx = new TransactionContext();
    expect(ctx.getSession()).toBeUndefined();
  });

  it('exposes the active session inside run()', async () => {
    const ctx = new TransactionContext();
    const session = fakeSession('s1');

    const seen = await ctx.run(session, async () => ctx.getSession());

    expect(seen).toBe(session);
  });

  it('propagates the session across awaited async boundaries', async () => {
    const ctx = new TransactionContext();
    const session = fakeSession('s1');

    const seen = await ctx.run(session, async () => {
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 1));
      return ctx.getSession();
    });

    expect(seen).toBe(session);
  });

  it('clears the session after run() resolves', async () => {
    const ctx = new TransactionContext();
    await ctx.run(fakeSession('s1'), async () => undefined);
    expect(ctx.getSession()).toBeUndefined();
  });

  it('clears the session after run() rejects', async () => {
    const ctx = new TransactionContext();
    await expect(
      ctx.run(fakeSession('s1'), async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(ctx.getSession()).toBeUndefined();
  });

  it('returns the value produced by the callback', async () => {
    const ctx = new TransactionContext();
    const result = await ctx.run(fakeSession('s1'), async () => 42);
    expect(result).toBe(42);
  });

  it('isolates concurrent transactions to their own session', async () => {
    const ctx = new TransactionContext();
    const a = fakeSession('a');
    const b = fakeSession('b');

    const [seenA, seenB] = await Promise.all([
      ctx.run(a, async () => {
        await new Promise((r) => setTimeout(r, 5));
        return ctx.getSession();
      }),
      ctx.run(b, async () => {
        await new Promise((r) => setTimeout(r, 1));
        return ctx.getSession();
      }),
    ]);

    expect(seenA).toBe(a);
    expect(seenB).toBe(b);
  });
});
