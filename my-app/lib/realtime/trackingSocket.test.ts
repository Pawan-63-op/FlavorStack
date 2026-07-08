import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const emit = vi.fn();
const disconnect = vi.fn();
const fakeSocket = { emit, disconnect };
const io = vi.fn(() => fakeSocket);

vi.mock("socket.io-client", () => ({
  io: (...args: unknown[]) => (io as unknown as (...a: unknown[]) => unknown)(...args),
}));

import {
  __resetTrackingSocket,
  getTrackingSocket,
  subscribeTracking,
  trackingSocketUrl,
  unsubscribeTracking,
} from "./trackingSocket";

describe("trackingSocketUrl", () => {
  const original = process.env.NEXT_PUBLIC_SOCKET_URL;
  afterEach(() => {
    process.env.NEXT_PUBLIC_SOCKET_URL = original;
  });

  it("targets the /tracking namespace on the configured origin", () => {
    process.env.NEXT_PUBLIC_SOCKET_URL = "http://localhost:3000";
    expect(trackingSocketUrl()).toBe("http://localhost:3000/tracking");
  });

  it("strips a trailing slash from the origin", () => {
    process.env.NEXT_PUBLIC_SOCKET_URL = "http://localhost:3000/";
    expect(trackingSocketUrl()).toBe("http://localhost:3000/tracking");
  });

  it("falls back to same-origin when unset", () => {
    delete process.env.NEXT_PUBLIC_SOCKET_URL;
    expect(trackingSocketUrl()).toBe("/tracking");
  });
});

describe("getTrackingSocket", () => {
  beforeEach(() => {
    __resetTrackingSocket();
    io.mockClear();
    emit.mockClear();
    disconnect.mockClear();
  });

  it("connects once with cookie auth and reuses the singleton", () => {
    const a = getTrackingSocket();
    const b = getTrackingSocket();

    expect(a).toBe(b);
    expect(io).toHaveBeenCalledTimes(1);
    const [url, opts] = io.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(url).toContain("/tracking");
    expect(opts).toMatchObject({ withCredentials: true, reconnection: true });
  });

  it("__resetTrackingSocket disconnects and lets a fresh socket be created", () => {
    getTrackingSocket();
    __resetTrackingSocket();
    getTrackingSocket();

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(io).toHaveBeenCalledTimes(2);
  });
});

describe("subscribe / unsubscribe", () => {
  beforeEach(() => {
    emit.mockClear();
    __resetTrackingSocket();
  });

  it("emits subscribe with the fulfillmentId", () => {
    const socket = getTrackingSocket();
    subscribeTracking(socket, "f1");
    expect(emit).toHaveBeenCalledWith("subscribe", { fulfillmentId: "f1" });
  });

  it("emits unsubscribe with the fulfillmentId", () => {
    const socket = getTrackingSocket();
    unsubscribeTracking(socket, "f1");
    expect(emit).toHaveBeenCalledWith("unsubscribe", { fulfillmentId: "f1" });
  });
});
