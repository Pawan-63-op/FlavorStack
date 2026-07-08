import { afterEach, describe, expect, it, vi } from "vitest";
import { type FeatureFlag } from "./featureFlags";

const DEFAULT_OFF_FLAGS: FeatureFlag[] = [
  "recipes",
  "favorites",
  "loyalty",
  "couponCatalog",
  "chat",
  "phoneVerification",
];

const ENV_KEYS: Record<FeatureFlag, string> = {
  recipes: "NEXT_PUBLIC_FEATURE_RECIPES",
  favorites: "NEXT_PUBLIC_FEATURE_FAVORITES",
  loyalty: "NEXT_PUBLIC_FEATURE_LOYALTY",
  couponCatalog: "NEXT_PUBLIC_FEATURE_COUPON_CATALOG",
  chat: "NEXT_PUBLIC_FEATURE_CHAT",
  notifications: "NEXT_PUBLIC_FEATURE_NOTIFICATIONS",
  tracking: "NEXT_PUBLIC_FEATURE_TRACKING",
  nearby: "NEXT_PUBLIC_FEATURE_NEARBY",
  phoneVerification: "NEXT_PUBLIC_FEATURE_PHONE_VERIFICATION",
  reviews: "NEXT_PUBLIC_FEATURE_REVIEWS",
  admin: "NEXT_PUBLIC_FEATURE_ADMIN",
  adminOps: "NEXT_PUBLIC_FEATURE_ADMIN_OPS",
};

async function loadIsEnabled() {
  vi.resetModules();
  const mod = await import("./featureFlags");
  return mod.isEnabled;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("isEnabled", () => {
  it.each(DEFAULT_OFF_FLAGS)("defaults %s to false", async (flag) => {
    const isEnabled = await loadIsEnabled();
    expect(isEnabled(flag)).toBe(false);
  });

  it("defaults notifications to true (Phase 8 shipped)", async () => {
    const isEnabled = await loadIsEnabled();
    expect(isEnabled("notifications")).toBe(true);
  });

  it("lets the env override disable notifications", async () => {
    vi.stubEnv(ENV_KEYS.notifications, "false");
    const isEnabled = await loadIsEnabled();
    expect(isEnabled("notifications")).toBe(false);
  });

  it("defaults reviews to true (Phase 9 shipped)", async () => {
    const isEnabled = await loadIsEnabled();
    expect(isEnabled("reviews")).toBe(true);
  });

  it("lets the env override disable reviews", async () => {
    vi.stubEnv(ENV_KEYS.reviews, "false");
    const isEnabled = await loadIsEnabled();
    expect(isEnabled("reviews")).toBe(false);
  });

  it("defaults admin to true (Phase 10 shipped)", async () => {
    const isEnabled = await loadIsEnabled();
    expect(isEnabled("admin")).toBe(true);
  });

  it("lets the env override disable admin", async () => {
    vi.stubEnv(ENV_KEYS.admin, "false");
    const isEnabled = await loadIsEnabled();
    expect(isEnabled("admin")).toBe(false);
  });

  it("defaults adminOps to true (Phase 11 shipped)", async () => {
    const isEnabled = await loadIsEnabled();
    expect(isEnabled("adminOps")).toBe(true);
  });

  it("lets the env override disable adminOps", async () => {
    vi.stubEnv(ENV_KEYS.adminOps, "false");
    const isEnabled = await loadIsEnabled();
    expect(isEnabled("adminOps")).toBe(false);
  });

  it("defaults tracking to true (Phase 15 G1/G3 shipped)", async () => {
    const isEnabled = await loadIsEnabled();
    expect(isEnabled("tracking")).toBe(true);
  });

  it("lets the env override disable tracking", async () => {
    vi.stubEnv(ENV_KEYS.tracking, "false");
    const isEnabled = await loadIsEnabled();
    expect(isEnabled("tracking")).toBe(false);
  });

  it("defaults nearby to true (Phase 4 browser-verified)", async () => {
    const isEnabled = await loadIsEnabled();
    expect(isEnabled("nearby")).toBe(true);
  });

  it("returns true when the env override is 'true'", async () => {
    vi.stubEnv(ENV_KEYS.tracking, "true");
    const isEnabled = await loadIsEnabled();
    expect(isEnabled("tracking")).toBe(true);
  });

  it("returns true when the env override is '1'", async () => {
    vi.stubEnv(ENV_KEYS.tracking, "1");
    const isEnabled = await loadIsEnabled();
    expect(isEnabled("tracking")).toBe(true);
  });

  it("returns false when the env override is 'false'", async () => {
    vi.stubEnv(ENV_KEYS.nearby, "false");
    const isEnabled = await loadIsEnabled();
    expect(isEnabled("nearby")).toBe(false);
  });

  it("falls back to the default for an unrecognized env value", async () => {
    vi.stubEnv(ENV_KEYS.chat, "yes");
    const isEnabled = await loadIsEnabled();
    expect(isEnabled("chat")).toBe(false);
  });
});
