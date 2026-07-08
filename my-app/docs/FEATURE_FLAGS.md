# Feature Flag Register

> **Source of truth:** `lib/config/featureFlags.ts`. Regenerate this table from
> the `DEFAULT_FLAGS` + `ENV_OVERRIDES` maps when flags change.

`isEnabled(flag)` resolves an env override first, falling back to the compiled
default. Overrides are read as **static** `process.env.NEXT_PUBLIC_*` member
access (Next.js only inlines `NEXT_PUBLIC_*` into client bundles when accessed
statically) and captured once at module load — values are **build-time**.
`parseBooleanEnv` accepts `"true"`/`"1"` → on and `"false"`/`"0"` → off;
anything else falls through to the default.

## Categories

- **Removed (off):** features with **no `server_2` backing** — decommissioned;
  the flag exists only to dark-launch any future re-introduction.
- **Progressive (off):** real `server_2` capabilities defaulting **off** pending
  a deliberate rollout; flip via the env override to enable.
- **Shipped (on):** completed integrations, **default on**; override to disable.

## Register (12 flags)

| Flag | Phase | Default | Env override | Category | Purpose |
| ---- | ----- | ------- | ------------ | -------- | ------- |
| `recipes` | — | `false` | `NEXT_PUBLIC_FEATURE_RECIPES` | Removed (off) | Legacy recipes; no server backing |
| `favorites` | — | `false` | `NEXT_PUBLIC_FEATURE_FAVORITES` | Removed (off) | Legacy favourites; no server backing |
| `loyalty` | — | `false` | `NEXT_PUBLIC_FEATURE_LOYALTY` | Removed (off) | Legacy loyalty; no server backing |
| `couponCatalog` | — | `false` | `NEXT_PUBLIC_FEATURE_COUPON_CATALOG` | Removed (off) | Legacy coupon catalog; no server backing (promo codes still apply via cart) |
| `chat` | — | `false` | `NEXT_PUBLIC_FEATURE_CHAT` | Removed (off) | Legacy chat; no server backing |
| `phoneVerification` | 2 | `false` | `NEXT_PUBLIC_FEATURE_PHONE_VERIFICATION` | Progressive (off) | Phone OTP verification UI |
| `nearby` | 4 | `false` | `NEXT_PUBLIC_FEATURE_NEARBY` | Progressive (off) | Serviceability / nearby restaurant search |
| `tracking` | 7 | `false` | `NEXT_PUBLIC_FEATURE_TRACKING` | Progressive (off) | Live order/fulfillment tracking (Socket.IO `/tracking`) |
| `notifications` | 8 | `true` | `NEXT_PUBLIC_FEATURE_NOTIFICATIONS` | Shipped (on) | Notifications center |
| `reviews` | 9 | `true` | `NEXT_PUBLIC_FEATURE_REVIEWS` | Shipped (on) | Dual-rating, verified-purchase reviews |
| `admin` | 10 | `true` | `NEXT_PUBLIC_FEATURE_ADMIN` | Shipped (on) | Owner console (catalog management) |
| `adminOps` | 11 | `true` | `NEXT_PUBLIC_FEATURE_ADMIN_OPS` | Shipped (on) | Platform-admin ops (review moderation, fulfillment dashboard) |

## Notes

- **`adminOps` gating is layered:** the flag defaults on, but the Moderation +
  Fulfillments tabs additionally require `user.isAdmin`; the read-only restaurant
  **Queue** tab is gated by **restaurant ownership**, not this flag.
- The five **Removed (off)** flags carry no `server_2` endpoints; enabling them
  surfaces UI with no working data path and is intended only for future
  re-introduction behind the same switch.
