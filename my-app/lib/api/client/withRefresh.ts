import { recordAuth401, recordAuthRefreshFailure } from "../../observability/metrics";
import { ApiError } from "../errors/ApiError";
import { emitAuthExpired } from "./authEvents";
import type { HttpMethod, RequestOptions } from "./types";

/**
 * The transport function this interceptor wraps. Matches the signature of the
 * raw `request` from `./http`, allowing the wrapper to be unit-tested against
 * an injected fake instead of `fetch`.
 */
export type RequestFn = <T>(
  method: HttpMethod,
  path: string,
  opts?: RequestOptions,
) => Promise<T>;

export interface RefreshOptions {
  /** Endpoint used to mint a fresh access token. Default `/auth/refresh`. */
  refreshPath?: string;
  /**
   * Paths whose `401`s must never trigger a refresh+retry — the auth endpoints
   * themselves. A 401 from these is a genuine credential failure, not an
   * expired session, so intercepting them would recurse or loop.
   */
  bypassPaths?: string[];
}

const DEFAULT_REFRESH_PATH = "/auth/refresh";
const DEFAULT_BYPASS_PATHS = ["/auth/login", "/auth/refresh"];

/** Strip query/hash and trailing slashes so path matching is robust. */
function normalizePath(path: string): string {
  const withoutQuery = path.split(/[?#]/)[0];
  const trimmed = withoutQuery.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

function isAuthError(err: unknown): err is ApiError {
  return err instanceof ApiError && err.category === "auth";
}

/**
 * Wrap a transport function with single-flight 401→refresh recovery.
 *
 * On an `auth`-category {@link ApiError}, the wrapper triggers a single shared
 * refresh request (single-flight): concurrent 401s queue onto the same promise
 * rather than each firing their own refresh. When the refresh resolves, every
 * queued request is retried **once**. When it rejects, all requests reject and
 * `auth:expired` is emitted exactly once for the cycle.
 *
 * Guards against loops:
 * - The refresh call uses the underlying transport directly, so its own
 *   response is never re-intercepted.
 * - Requests to {@link RefreshOptions.bypassPaths} (login/refresh) are never
 *   intercepted.
 * - A request is retried at most once; a second 401 propagates unchanged.
 */
export function createRefreshingRequest(
  underlying: RequestFn,
  options: RefreshOptions = {},
): RequestFn {
  const refreshPath = options.refreshPath ?? DEFAULT_REFRESH_PATH;
  const bypassPaths = (options.bypassPaths ?? DEFAULT_BYPASS_PATHS).map(
    normalizePath,
  );

  let refreshPromise: Promise<void> | null = null;

  function isBypassed(path: string): boolean {
    return bypassPaths.includes(normalizePath(path));
  }

  function refresh(): Promise<void> {
    if (!refreshPromise) {
      refreshPromise = underlying<unknown>("POST", refreshPath)
        .then(() => undefined)
        .catch((err) => {
          recordAuthRefreshFailure();
          emitAuthExpired();
          throw err;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }
    return refreshPromise;
  }

  return async function refreshingRequest<T>(
    method: HttpMethod,
    path: string,
    opts?: RequestOptions,
  ): Promise<T> {
    try {
      return await underlying<T>(method, path, opts);
    } catch (err) {
      if (!isAuthError(err) || isBypassed(path)) {
        throw err;
      }

      recordAuth401({ path: normalizePath(path) });

      try {
        await refresh();
      } catch {
        throw err;
      }

      return await underlying<T>(method, path, opts);
    }
  };
}
