/**
 * Dark-launch registry for features being removed (no server_2 backing,
 * decommissioned in Phase 3) or added (server_2 capabilities the FE lacks
 * yet, landing in their respective phases). All default `false` until the
 * consuming phase wires the feature behind the flag.
 *
 * NAMING NOTE (Phase 14.5) — the two "admin-ish" flags are historically named
 * after their phase, not their audience. Read them as:
 *   - `admin`    = **OWNER CONSOLE** — the restaurant-owner surface (catalog
 *                  management + the owner order Queue). Gated by restaurant
 *                  ownership, NOT by `user.isAdmin`.
 *   - `adminOps` = **PLATFORM ADMIN** — true platform-admin ops (review
 *                  moderation + the fulfillment dashboard). Those tabs
 *                  additionally require `user.isAdmin`.
 * The env overrides keep the legacy names (`NEXT_PUBLIC_FEATURE_ADMIN`,
 * `NEXT_PUBLIC_FEATURE_ADMIN_OPS`); a rename was deferred to avoid churning
 * deploy configs/docs (consistent with the Phase 14.0 "minimal" decision).
 */
export type FeatureFlag =
  | "recipes"
  | "favorites"
  | "loyalty"
  | "couponCatalog"
  | "chat"
  | "notifications" // Phase 8 — notifications center
  | "tracking" // Phase 7 — live order/fulfillment tracking
  | "nearby" // Phase 4 — serviceability/nearby restaurant search
  | "phoneVerification" // Phase 2 — phone OTP verification
  | "reviews" // Phase 9 — dual-rating, verified-purchase reviews
  | "admin" // = OWNER CONSOLE (Phase 10) — restaurant-owner catalog mgmt + order Queue
  | "adminOps"; // = PLATFORM ADMIN (Phase 11) — review moderation + fulfillment dashboard

const DEFAULT_FLAGS: Record<FeatureFlag, boolean> = {
  recipes: false,
  favorites: false,
  loyalty: false,
  couponCatalog: false,
  chat: false,
  notifications: true,
  tracking: true,
  nearby: true,
  phoneVerification: false,
  reviews: true,
  admin: true,
  adminOps: true,
};

/**
 * Per-flag env overrides, read by STATIC `process.env.NEXT_PUBLIC_*` member
 * access. This is deliberate: Next.js only inlines `NEXT_PUBLIC_*` vars into
 * CLIENT bundles when accessed statically — a dynamic `process.env[key]` lookup
 * is left untouched and resolves to `undefined` in the browser, so a client
 * component (e.g. the Phase 4 `nearby` UI) would never see its flag. Captured
 * once at module load; `NEXT_PUBLIC_*` values are build-time by design.
 */
const ENV_OVERRIDES: Record<FeatureFlag, string | undefined> = {
  recipes: process.env.NEXT_PUBLIC_FEATURE_RECIPES,
  favorites: process.env.NEXT_PUBLIC_FEATURE_FAVORITES,
  loyalty: process.env.NEXT_PUBLIC_FEATURE_LOYALTY,
  couponCatalog: process.env.NEXT_PUBLIC_FEATURE_COUPON_CATALOG,
  chat: process.env.NEXT_PUBLIC_FEATURE_CHAT,
  notifications: process.env.NEXT_PUBLIC_FEATURE_NOTIFICATIONS,
  tracking: process.env.NEXT_PUBLIC_FEATURE_TRACKING,
  nearby: process.env.NEXT_PUBLIC_FEATURE_NEARBY,
  phoneVerification: process.env.NEXT_PUBLIC_FEATURE_PHONE_VERIFICATION,
  reviews: process.env.NEXT_PUBLIC_FEATURE_REVIEWS,
  admin: process.env.NEXT_PUBLIC_FEATURE_ADMIN,
  adminOps: process.env.NEXT_PUBLIC_FEATURE_ADMIN_OPS,
};

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return undefined;
}

export function isEnabled(flag: FeatureFlag): boolean {
  const override = parseBooleanEnv(ENV_OVERRIDES[flag]);
  return override ?? DEFAULT_FLAGS[flag];
}
