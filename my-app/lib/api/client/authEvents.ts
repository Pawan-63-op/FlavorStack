/**
 * Tiny pub/sub for auth lifecycle signals emitted by the API client.
 *
 * The only event today is `auth:expired`, fired when a token refresh cycle
 * fails and the session can no longer be recovered. Phase 1 wires a listener
 * that clears auth stores and redirects to login. Phase 0 only provides the
 * signal — no UI behavior is attached here.
 */

export type AuthExpiredListener = () => void;

const listeners = new Set<AuthExpiredListener>();

/**
 * Subscribe to `auth:expired`. Returns an unsubscribe function.
 */
export function onAuthExpired(listener: AuthExpiredListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Emit `auth:expired` to every subscriber. Iterates over a snapshot so a
 * listener may unsubscribe itself during dispatch without skipping others.
 */
export function emitAuthExpired(): void {
  for (const listener of [...listeners]) {
    listener();
  }
}

/**
 * Remove all subscribers. Intended for test isolation.
 */
export function clearAuthListeners(): void {
  listeners.clear();
}
