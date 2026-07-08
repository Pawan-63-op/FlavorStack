# Testing `my-app`

The consolidated test story for the customer + admin frontend (Phase 12, Batch
12.1). Two lanes:

| Lane | Tool | Backend | Where |
| --- | --- | --- | --- |
| **Unit / contract** | Vitest (`jsdom`, serial) | none — `fetch` is mocked | `**/*.test.ts(x)` co-located with source |
| **E2E / regression** | Playwright (`workers:1`, serial) | live `server_2` dev stack | `e2e/*.spec.ts` |

Both run serially by design: Vitest with `fileParallelism:false` + `pool:"forks"`
(the `--runInBand` equivalent), Playwright with `workers:1` / `fullyParallel:false`
because auth/cookie state is shared infrastructure.

---

## Unit / contract (Vitest) — no backend needed

```bash
npm run test            # run all 75 files once (serial)
npm run test:watch      # watch mode
npm run test:coverage   # run + v8 coverage (text + html + lcov)
```

Coverage is scoped to the integration surface (`lib/api/**`, `store/**`,
`lib/config/**`) and written to `coverage/` (gitignored). Open
`coverage/index.html` for the HTML report; `coverage/lcov.info` feeds CI.

### Coverage baseline (2026-06-25)

| Metric | Baseline | Threshold (pinned just under) |
| --- | --- | --- |
| Statements | 73.49% | 72% |
| Branches | 76.40% | 75% |
| Functions | 61.31% | 60% |
| Lines | 74.19% | 72% |

Thresholds (in `vitest.config.ts`) are pinned **just under** the measured
baseline so CI gates on *no regression*, not an arbitrary target. The global
numbers are held down by `lib/api/hooks` (React hooks — exercised by Playwright,
not Vitest); the pure adapters/services/client/errors layers sit at **95–100%**.
Regenerate the baseline with `npm run test:coverage` and re-pin if the surface
changes materially.

---

## E2E / regression (Playwright) — needs a live, seeded `server_2`

The suite is **self-seeding**: a Playwright `globalSetup`
(`e2e/fixtures/seed.ts`) provisions the two shared accounts once per run (the
verified `TEST_USER` customer + the `ADMIN_USER`), and each spec seeds its own
per-test data (restaurants/orders/reviews) namespaced with unique emails/ids.
All specs import their seeding from the single barrel `e2e/fixtures/seed.ts`.

### 1. Start `server_2` with the dev override (non-Secure cookies)

```bash
cd ../server_2
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

> ⚠️ **`Secure`-cookie gotcha.** The prod image sets `NODE_ENV=production`, which
> flags the auth cookies `Secure` — a browser **drops them over plain
> `http://localhost`**. Always boot with the **dev override** (`NODE_ENV`
> unset/`development` → non-Secure cookies). Login otherwise returns 200 but the
> session never sticks.

> ⚠️ **CORS / `ALLOWED_ORIGINS`.** The dev app under test runs on **:3100** and
> proxies `/api/v1/*` to `server_2` on **:3000**, so the proxied login carries
> the `:3100` Origin. `server_2` must allow it — set in `server_2/.env`:
>
> ```
> ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3100
> ```
> then `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d api`.

Verify it serves (no `/health` route is mounted):

```bash
curl -i http://localhost:3000/api/v1/catalog/restaurants   # expect 200
```

### 2. Credentials + container names (`e2e/.env`, gitignored)

```bash
cp e2e/.env.example e2e/.env
```

Defaults match the documented local fixture and the default compose container
names (`server_2-mongo-1`, `server_2-redis-1`). The fixtures `docker exec` into
those containers to (a) read OTP codes from Redis and (b) promote the ADMIN /
flip `isEmailVerified` and insert a PENDING review in Mongo. Override via
`E2E_MONGO_CONTAINER` / `E2E_REDIS_CONTAINER` if your compose project name
differs.

### 3. Install the browser (first run only)

```bash
npx playwright install chromium
```

### 4. Run

```bash
npm run test:e2e         # full @regression run (serial; auto-boots next dev :3100)
npm run test:e2e:smoke   # @smoke subset only (fast signal)
npx playwright test --list   # show every spec + its tags
```

Some specs are **build-time flag-gated** (the dev server `playwright.config.ts`
boots bakes `NEXT_PUBLIC_FEATURE_*` in). To exercise the on-branch of those:

```bash
NEXT_PUBLIC_FEATURE_REVIEWS=true npm run test:e2e -- reviews.spec.ts
NEXT_PUBLIC_FEATURE_TRACKING=true npm run test:e2e -- live-tracking.spec.ts
NEXT_PUBLIC_FEATURE_NOTIFICATIONS=true npm run test:e2e -- notifications.spec.ts
NEXT_PUBLIC_FEATURE_NEARBY=true npm run test:e2e -- nearby.spec.ts
```

---

## Tag taxonomy

Tags live in each `test.describe` title and are selected with `--grep`:

| Tag | Scope | When |
| --- | --- | --- |
| `@regression` | **every** spec (18 files) | full serial run — nightly / `workflow_dispatch` in CI |
| `@smoke` | auth + cart→checkout + one admin path | fast PR signal — `npm run test:e2e:smoke` |

`@smoke` covers: `auth.spec.ts` (login/refresh/logout lifecycle),
`checkout.spec.ts` (cart→checkout), `admin-auth.spec.ts` (admin auth gate). Every
`@smoke` spec is also `@regression`.

---

## Seeding surface (`e2e/fixtures/seed.ts`)

A single barrel re-exporting the per-phase fixture helpers plus a named `Seeder`
surface (wraps existing helpers — no new seeding mechanism):

| Method | Wraps | Notes |
| --- | --- | --- |
| `Seeder.seedVerifiedCustomer` | register + Mongo `isEmailVerified` flip | shared `TEST_USER`; idempotent; run by `globalSetup` |
| `Seeder.seedAdmin` | `provisionAdmin` | shared `ADMIN_USER`; idempotent; run by `globalSetup` |
| `Seeder.seedServiceableRestaurant` | `seedServiceableRestaurant` | published + serviceable restaurant w/ menu + zone |
| `Seeder.seedCompletedFulfillment` | `placeCodOrder` + `awaitCreatedFulfillment` | terminal browser-reachable state is `CREATED` (frozen-backend ownership wall) |
| `Seeder.seedPendingReview` | `seedPendingReview` | direct Mongo insert (review moderation queue) |

---

## CI (Phase 12, Batch 12.2)

Two GitHub Actions workflows automate the lanes above (root `.github/workflows/`):

| Workflow | Trigger | Jobs / scope |
| --- | --- | --- |
| `my-app-ci.yml` | PR + push touching `my-app/**` | `lint`, `typecheck`, `unit` (`test:coverage` + lcov artifact), `build` — four independent jobs gating the PR. No backend. |
| `my-app-e2e.yml` | PR (`@smoke`) · nightly cron (`@regression`) · `workflow_dispatch` (choose) | Boots the real `server_2` compose stack, waits for catalog readiness, runs the tagged Playwright suite (`--workers=1`), uploads the report/traces. |

### Mirror CI locally before pushing

```bash
# Unit lane (no backend):
npm run lint && npm run typecheck && npm run test:coverage && npm run build

# E2E lane (needs the live stack — see §"E2E / regression" above):
docker compose -p server_2 \
  -f ../server_2/docker-compose.yml \
  -f ../server_2/docker-compose.dev.yml up -d --build
npm run test:e2e          # full @regression   (or `npm run test:e2e:smoke`)
```

### E2E env contract

The E2E workflow threads these into the Playwright process; the fixtures' defaults
already match, so local runs need no overrides:

| Var | CI value | Why |
| --- | --- | --- |
| `E2E_BASE_URL` | `http://localhost:3100` | dev app under test (own port) |
| `API_PROXY_TARGET` | `http://localhost:3000` | server_2 gateway the proxy forwards `/api/v1` to |
| `E2E_MONGO_CONTAINER` | `server_2-mongo-1` | Mongo seeders `docker exec` target |
| `E2E_REDIS_CONTAINER` | `server_2-redis-1` | OTP/rate-limit seeders `docker exec` target |

The container names come from the **pinned compose project** `-p server_2` — drift
between the local and CI project name breaks the `docker exec` seeders, so the
workflow pins it explicitly. The workflow also synthesizes `server_2/.env`
(gitignored): an ephemeral RS256 JWT pair, a dummy `RESEND_API_KEY` (email is
unused — OTPs are read from Redis), and `ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3100`
so the proxied `:3100`-origin login passes CORS. The dev override
(`docker-compose.dev.yml` → `NODE_ENV=development`) keeps cookies non-`Secure` so
browser auth works over plain http on the runner.
