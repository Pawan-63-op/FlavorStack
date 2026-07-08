import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import {
  invalidatePreferenceCaches,
  performPreferenceUpdate,
} from "./useNotificationPreferences";
import { queryKeys } from "../queryKeys";
import { notificationService } from "../services/notification";
import type { PreferenceChannelMap } from "../adapters/notificationPreferences";

vi.mock("../services/notification", () => ({
  notificationService: {
    updatePreferences: vi.fn(),
  },
}));

function makeMap(overrides: Partial<PreferenceChannelMap> = {}): PreferenceChannelMap {
  return {
    ORDER_UPDATES: { push: true, email: true },
    DELIVERY: { push: true, email: true },
    SECURITY: { push: true, email: true },
    PROMOTIONS: { push: true, email: false },
    ...overrides,
  };
}

describe("performPreferenceUpdate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PUTs only the changed toggles when the state differs", async () => {
    vi.mocked(notificationService.updatePreferences).mockResolvedValue({
      userId: "u1",
      rows: [],
      channels: makeMap(),
      updatedAt: "2026-06-22T10:00:00.000Z",
    });

    const prev = makeMap();
    const next = makeMap({ DELIVERY: { push: false, email: true } });

    await performPreferenceUpdate({ prev, next });

    expect(notificationService.updatePreferences).toHaveBeenCalledWith([
      { category: "DELIVERY", channel: "PUSH", enabled: false },
    ]);
  });

  it("skips the request and resolves null when nothing changed", async () => {
    const result = await performPreferenceUpdate({ prev: makeMap(), next: makeMap() });

    expect(result).toBeNull();
    expect(notificationService.updatePreferences).not.toHaveBeenCalled();
  });
});

describe("invalidatePreferenceCaches", () => {
  it("invalidates the preferences query key", () => {
    const invalidateQueries = vi.fn();
    const queryClient = { invalidateQueries } as unknown as QueryClient;

    invalidatePreferenceCaches(queryClient);

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.notifications.preferences(),
    });
  });
});
