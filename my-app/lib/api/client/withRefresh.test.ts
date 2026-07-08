import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../errors/ApiError";
import {
  resetReporter,
  setReporter,
  type Reporter,
} from "../../observability/reporter";
import { clearAuthListeners, emitAuthExpired, onAuthExpired } from "./authEvents";
import { client } from "./http";
import { createRefreshingRequest, type RequestFn } from "./withRefresh";

function authError(): ApiError {
  return new ApiError({
    status: 401,
    code: "invalid_token",
    message: "Access token expired",
  });
}

function notFoundError(): ApiError {
  return new ApiError({
    status: 404,
    code: "NOT_FOUND",
    message: "Missing",
  });
}

/** Count how many times the underlying mock was invoked for a given path. */
function callsForPath(mock: ReturnType<typeof vi.fn>, path: string): number {
  return mock.mock.calls.filter((call) => call[1] === path).length;
}

describe("createRefreshingRequest", () => {
  afterEach(() => {
    clearAuthListeners();
  });

  it("returns the result of a successful request without refreshing", async () => {
    const underlying = vi.fn(async () => ({ ok: true })) as unknown as RequestFn;
    const request = createRefreshingRequest(underlying);

    const result = await request("GET", "/catalog/restaurants");

    expect(result).toEqual({ ok: true });
    expect(callsForPath(underlying as never, "/auth/refresh")).toBe(0);
  });

  it("passes a non-auth error through untouched without refreshing", async () => {
    const underlying = vi.fn(async () => {
      throw notFoundError();
    }) as unknown as RequestFn;
    const request = createRefreshingRequest(underlying);

    await expect(request("GET", "/catalog/missing")).rejects.toMatchObject({
      status: 404,
      category: "notFound",
    });
    expect(callsForPath(underlying as never, "/auth/refresh")).toBe(0);
  });

  it("passes a non-ApiError rejection through untouched", async () => {
    const boom = new Error("boom");
    const underlying = vi.fn(async () => {
      throw boom;
    }) as unknown as RequestFn;
    const request = createRefreshingRequest(underlying);

    await expect(request("GET", "/catalog/restaurants")).rejects.toBe(boom);
    expect(callsForPath(underlying as never, "/auth/refresh")).toBe(0);
  });

  it("on a 401, refreshes once then retries the request and returns its result", async () => {
    let dataCalls = 0;
    const underlying = vi.fn(async (_method: string, path: string) => {
      if (path === "/auth/refresh") return undefined;
      dataCalls += 1;
      if (dataCalls === 1) throw authError();
      return { ok: true };
    }) as unknown as RequestFn;
    const request = createRefreshingRequest(underlying);

    const result = await request("GET", "/users/me");

    expect(result).toEqual({ ok: true });
    expect(callsForPath(underlying as never, "/auth/refresh")).toBe(1);
    expect(callsForPath(underlying as never, "/users/me")).toBe(2);
  });

  it("retries at most once — a second 401 after refresh propagates without re-refreshing", async () => {
    const underlying = vi.fn(async (_method: string, path: string) => {
      if (path === "/auth/refresh") return undefined;
      throw authError();
    }) as unknown as RequestFn;
    const request = createRefreshingRequest(underlying);

    await expect(request("GET", "/users/me")).rejects.toMatchObject({
      category: "auth",
    });
    expect(callsForPath(underlying as never, "/auth/refresh")).toBe(1);
    expect(callsForPath(underlying as never, "/users/me")).toBe(2);
  });

  it("collapses N concurrent 401s into exactly one refresh call", async () => {
    const N = 5;
    let dataCalls = 0;
    const underlying = vi.fn(async (_method: string, path: string) => {
      if (path === "/auth/refresh") return undefined;
      dataCalls += 1;
      if (dataCalls <= N) throw authError();
      return { ok: true };
    }) as unknown as RequestFn;
    const request = createRefreshingRequest(underlying);

    const results = await Promise.all(
      Array.from({ length: N }, () => request("GET", "/users/me")),
    );

    expect(results).toEqual(Array.from({ length: N }, () => ({ ok: true })));
    expect(callsForPath(underlying as never, "/auth/refresh")).toBe(1);
    expect(callsForPath(underlying as never, "/users/me")).toBe(2 * N);
  });

  it("rejects all queued requests and fires auth:expired once when refresh fails", async () => {
    const N = 4;
    const underlying = vi.fn(async (_method: string, path: string) => {
      if (path === "/auth/refresh") throw authError();
      throw authError();
    }) as unknown as RequestFn;
    const request = createRefreshingRequest(underlying);

    let expiredCount = 0;
    onAuthExpired(() => {
      expiredCount += 1;
    });

    const settled = await Promise.allSettled(
      Array.from({ length: N }, () => request("GET", "/users/me")),
    );

    expect(settled.every((r) => r.status === "rejected")).toBe(true);
    expect(callsForPath(underlying as never, "/auth/refresh")).toBe(1);
    expect(expiredCount).toBe(1);
  });

  it("does not intercept a 401 from the refresh endpoint itself (no recursion)", async () => {
    const underlying = vi.fn(async () => {
      throw authError();
    }) as unknown as RequestFn;
    const request = createRefreshingRequest(underlying);

    await expect(request("POST", "/auth/refresh")).rejects.toMatchObject({
      category: "auth",
    });
    expect(callsForPath(underlying as never, "/auth/refresh")).toBe(1);
  });

  it("does not intercept a 401 from the login endpoint", async () => {
    const underlying = vi.fn(async () => {
      throw authError();
    }) as unknown as RequestFn;
    const request = createRefreshingRequest(underlying);

    await expect(request("POST", "/auth/login")).rejects.toMatchObject({
      category: "auth",
    });
    expect(callsForPath(underlying as never, "/auth/refresh")).toBe(0);
  });

  it("ignores query strings and trailing slashes when matching bypass paths", async () => {
    const underlying = vi.fn(async () => {
      throw authError();
    }) as unknown as RequestFn;
    const request = createRefreshingRequest(underlying);

    await expect(
      request("POST", "/auth/login/?redirect=%2Fhome"),
    ).rejects.toMatchObject({ category: "auth" });
    expect(callsForPath(underlying as never, "/auth/refresh")).toBe(0);
  });

  it("resets single-flight state so a later 401 triggers a fresh refresh", async () => {
    let phaseOneDone = false;
    let attemptInPhase = 0;
    const underlying = vi.fn(async (_method: string, path: string) => {
      if (path === "/auth/refresh") return undefined;
      attemptInPhase += 1;
      if (attemptInPhase === 1) throw authError();
      return { phase: phaseOneDone ? 2 : 1 };
    }) as unknown as RequestFn;
    const request = createRefreshingRequest(underlying);

    await request("GET", "/users/me");
    phaseOneDone = true;
    attemptInPhase = 0;
    await request("GET", "/users/me");

    expect(callsForPath(underlying as never, "/auth/refresh")).toBe(2);
  });

  it("supports overriding the refresh and bypass paths", async () => {
    let dataCalls = 0;
    const underlying = vi.fn(async (_method: string, path: string) => {
      if (path === "/custom/refresh") return undefined;
      dataCalls += 1;
      if (dataCalls === 1) throw authError();
      return { ok: true };
    }) as unknown as RequestFn;
    const request = createRefreshingRequest(underlying, {
      refreshPath: "/custom/refresh",
      bypassPaths: ["/custom/refresh", "/custom/login"],
    });

    const result = await request("GET", "/users/me");

    expect(result).toEqual({ ok: true });
    expect(callsForPath(underlying as never, "/custom/refresh")).toBe(1);
  });
});

describe("createRefreshingRequest — observability metrics (Batch 12.4)", () => {
  function metricsSpy(): Reporter & { names: string[] } {
    const names: string[] = [];
    return {
      names,
      captureError() {},
      incrementMetric(name) {
        names.push(name);
      },
    };
  }

  afterEach(() => {
    clearAuthListeners();
    resetReporter();
  });

  it("increments auth.401 when an intercepted 401 triggers the refresh path", async () => {
    const spy = metricsSpy();
    setReporter(spy);
    let dataCalls = 0;
    const underlying = vi.fn(async (_method: string, path: string) => {
      if (path === "/auth/refresh") return undefined;
      dataCalls += 1;
      if (dataCalls === 1) throw authError();
      return { ok: true };
    }) as unknown as RequestFn;
    const request = createRefreshingRequest(underlying);

    await request("GET", "/users/me");

    expect(spy.names).toContain("auth.401");
  });

  it("does not increment auth.401 for a bypassed (login) 401", async () => {
    const spy = metricsSpy();
    setReporter(spy);
    const underlying = vi.fn(async () => {
      throw authError();
    }) as unknown as RequestFn;
    const request = createRefreshingRequest(underlying);

    await expect(request("POST", "/auth/login")).rejects.toMatchObject({
      category: "auth",
    });

    expect(spy.names).not.toContain("auth.401");
  });

  it("increments auth.refresh.failure exactly once when refresh fails", async () => {
    const spy = metricsSpy();
    setReporter(spy);
    const underlying = vi.fn(async (_method: string, path: string) => {
      if (path === "/auth/refresh") throw authError();
      throw authError();
    }) as unknown as RequestFn;
    const request = createRefreshingRequest(underlying);

    const settled = await Promise.allSettled(
      Array.from({ length: 3 }, () => request("GET", "/users/me")),
    );

    expect(settled.every((r) => r.status === "rejected")).toBe(true);
    expect(spy.names.filter((n) => n === "auth.refresh.failure")).toHaveLength(1);
  });
});

describe("composed client (http.ts wiring)", () => {
  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    clearAuthListeners();
  });

  it("recovers a 401 by refreshing through the real fetch transport and retrying", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/v1/auth/refresh") {
        return jsonResponse({ ok: true });
      }
      if (fetchMock.mock.calls.filter((c) => c[0] === "/api/v1/users/me").length === 1) {
        return jsonResponse(
          { error: { code: "invalid_token", message: "expired" } },
          401,
        );
      }
      return jsonResponse({ id: "u1" });
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const result = await client.get<{ id: string }>("/users/me");

    expect(result).toEqual({ id: "u1" });
    const refreshCalls = fetchMock.mock.calls.filter(
      (c) => c[0] === "/api/v1/auth/refresh",
    );
    expect(refreshCalls).toHaveLength(1);
  });
});

describe("authEvents", () => {
  afterEach(() => {
    clearAuthListeners();
  });

  it("invokes registered listeners on emit", () => {
    const calls: number[] = [];
    onAuthExpired(() => calls.push(1));
    onAuthExpired(() => calls.push(2));

    emitAuthExpired();

    expect(calls).toEqual([1, 2]);
  });

  it("stops invoking a listener after it unsubscribes", () => {
    let count = 0;
    const unsubscribe = onAuthExpired(() => {
      count += 1;
    });

    emitAuthExpired();
    unsubscribe();
    emitAuthExpired();

    expect(count).toBe(1);
  });
});
