import { describe, expect, it } from "vitest";
import {
  diffPreferences,
  notificationPreferencesAdapter,
  type NotificationPreferenceResponse,
  type PreferenceChannelMap,
} from "./notificationPreferences";

function makeResponse(
  overrides: Partial<NotificationPreferenceResponse> = {},
): NotificationPreferenceResponse {
  return {
    userId: "u1",
    channels: {
      ORDER_UPDATES: { push: true, email: true },
      DELIVERY: { push: true, email: true },
      SECURITY: { push: true, email: true },
      PROMOTIONS: { push: true, email: false },
    },
    updatedAt: "2026-06-22T10:00:00.000Z",
    ...overrides,
  };
}

describe("notificationPreferencesAdapter", () => {
  it("renders rows in a stable category order with labels", () => {
    const view = notificationPreferencesAdapter(makeResponse());
    expect(view.rows.map((r) => r.category)).toEqual([
      "ORDER_UPDATES",
      "DELIVERY",
      "SECURITY",
      "PROMOTIONS",
    ]);
    expect(view.rows[0].label).toBe("Order updates");
  });

  it("carries the server toggle states verbatim (incl. promotions email off)", () => {
    const view = notificationPreferencesAdapter(makeResponse());
    const promotions = view.rows.find((r) => r.category === "PROMOTIONS");
    expect(promotions).toMatchObject({ push: true, email: false });
    expect(view.channels.PROMOTIONS).toEqual({ push: true, email: false });
  });

  it("exposes an editable channels map matching the rows", () => {
    const view = notificationPreferencesAdapter(makeResponse());
    expect(view.channels.ORDER_UPDATES).toEqual({ push: true, email: true });
    expect(view.userId).toBe("u1");
  });
});

describe("diffPreferences", () => {
  function makeMap(overrides: Partial<PreferenceChannelMap> = {}): PreferenceChannelMap {
    return {
      ORDER_UPDATES: { push: true, email: true },
      DELIVERY: { push: true, email: true },
      SECURITY: { push: true, email: true },
      PROMOTIONS: { push: true, email: false },
      ...overrides,
    };
  }

  it("returns no changes when nothing was toggled", () => {
    expect(diffPreferences(makeMap(), makeMap())).toEqual([]);
  });

  it("emits only the toggles that changed, with the desired (next) value", () => {
    const prev = makeMap();
    const next = makeMap({
      ORDER_UPDATES: { push: false, email: true },
      PROMOTIONS: { push: true, email: true },
    });

    expect(diffPreferences(prev, next)).toEqual([
      { category: "ORDER_UPDATES", channel: "PUSH", enabled: false },
      { category: "PROMOTIONS", channel: "EMAIL", enabled: true },
    ]);
  });

  it("captures both channels of a category when both flip", () => {
    const prev = makeMap({ DELIVERY: { push: true, email: true } });
    const next = makeMap({ DELIVERY: { push: false, email: false } });

    expect(diffPreferences(prev, next)).toEqual([
      { category: "DELIVERY", channel: "PUSH", enabled: false },
      { category: "DELIVERY", channel: "EMAIL", enabled: false },
    ]);
  });
});
