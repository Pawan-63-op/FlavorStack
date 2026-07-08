import { describe, expect, it } from "vitest";
import { toggleChannel } from "./PreferenceToggles";
import type { PreferenceChannelMap } from "@/lib/api/adapters/notificationPreferences";

function makeMap(): PreferenceChannelMap {
  return {
    ORDER_UPDATES: { push: true, email: true },
    DELIVERY: { push: true, email: true },
    SECURITY: { push: true, email: true },
    PROMOTIONS: { push: true, email: false },
  };
}

describe("toggleChannel", () => {
  it("flips the push channel of one category without touching others", () => {
    const next = toggleChannel(makeMap(), "ORDER_UPDATES", "PUSH", false);
    expect(next.ORDER_UPDATES).toEqual({ push: false, email: true });
    expect(next.DELIVERY).toEqual({ push: true, email: true });
  });

  it("flips the email channel independently of push", () => {
    const next = toggleChannel(makeMap(), "PROMOTIONS", "EMAIL", true);
    expect(next.PROMOTIONS).toEqual({ push: true, email: true });
  });

  it("does not mutate the input map", () => {
    const map = makeMap();
    toggleChannel(map, "SECURITY", "PUSH", false);
    expect(map.SECURITY).toEqual({ push: true, email: true });
  });
});
