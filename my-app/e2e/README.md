# Auth E2E (Playwright)

Browser proof of the Phase 1 auth lifecycle — login, session restore, transparent
refresh, guarded redirect, logout — against a **live server_2** with a **seeded
verified customer**. Serial (`workers: 1`); cookie/session state is shared.

## Why a separate dev port

`server_2`'s API gateway owns host **:3000** (`docker compose`). The Next dev app
under test therefore runs on its **own** port (**:3100** by default) and proxies
`/api/v1/*` to server_2, so the session cookies stay first-party. Override via
`E2E_BASE_URL` / `API_PROXY_TARGET` (see below).

> ⚠️ **`Secure`-cookie gotcha.** The prod Docker image sets `NODE_ENV=production`,
> which flags the auth cookies `Secure` — a browser **drops them over plain
> `http://localhost`**. Always start server_2 with the **dev override**
> (`NODE_ENV` unset → non-Secure cookies). Login otherwise returns 200 but the
> session never sticks.

## Prerequisites

### 1. Start server_2 (dev override — non-Secure cookies)

```bash
cd ../server_2
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

> ⚠️ **Allow the E2E origin through CORS.** server_2 only allows
> `http://localhost:3000` by default; the proxied login carries the dev app's
> Origin (`http://localhost:3100`), which CORS otherwise rejects
> (`"Not allowed by CORS"`, login stays on `/login`). Set `ALLOWED_ORIGINS` in
> `server_2/.env` and recreate the `api` container:
>
> ```bash
> # server_2/.env
> ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3100
> ```
> ```bash
> docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d api
> ```

Verify it serves (no `/health` route is mounted):

```bash
curl -i http://localhost:3000/api/v1/catalog/restaurants   # expect 200
```

### 2. Seed a verified customer

Register through the API, then flip `isEmailVerified` directly in Mongo (Phase 1
has no verification flow — that lands in Phase 2):

```bash
# Register (creates an unverified CUSTOMER)
curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test Customer","email":"testcustomer@flavorstack.local","password":"Test@1234"}'

# Flip the verification flag in the `users` collection
cd ../server_2
docker compose exec -T mongo mongosh flavorstack --quiet --eval \
  'db.users.updateOne({email:"testcustomer@flavorstack.local"},{$set:{isEmailVerified:true}})'
```

### 3. Credentials in `e2e/.env` (gitignored)

```bash
cp e2e/.env.example e2e/.env   # then edit if you used different values
```

`e2e/.env`:

```
E2E_USER_EMAIL=testcustomer@flavorstack.local
E2E_USER_PASSWORD=Test@1234
# Optional overrides:
# E2E_BASE_URL=http://localhost:3100
# API_PROXY_TARGET=http://localhost:3000
```

### 4. Install Playwright browsers (first run only)

```bash
npx playwright install chromium
```

## Run

```bash
npm run test:e2e            # serial; auto-boots `next dev` on :3100
npm run test:e2e -- --headed --debug   # interactive
```

The `webServer` block in `playwright.config.ts` starts (or reuses) the dev app
automatically; you do not need to run `npm run dev` yourself.

## Scenarios (`auth.spec.ts` — Phase 1)

| Scenario | Asserts |
|----------|---------|
| login | session cookies set, lands on a protected route |
| reload | `/users/me` restore keeps the session across a reload |
| refresh recovery | dropping `access_token` (keeping `refresh_token`) recovers via **one** `/auth/refresh`, no logout |
| guarded redirect | protected route while logged out → `/login?from=…` |
| logout | cookies cleared, back on `/login` |

Refresh recovery forces expiry by **deleting the cookie**, not by waiting the real
15 minutes.

## Scenarios (`auth-register.spec.ts` — Phase 2)

| Scenario | Asserts |
|----------|---------|
| register → verify | a fresh customer registers (E.164 phone + strong pw) → **auto-login** → email OTP → phone OTP → lands in the app |
| forgot → reset | request a reset → enter the code → set a new password → log in with it |

### OTP codes come from Redis (no inbox)

server_2 issues OTPs into Redis **before** delivery, and local delivery is a
placeholder — so the suite reads the real 6-digit code straight from Redis
(`e2e/fixtures/otp.ts`) keyed by the user id (`/users/me` → `id`):

```
otp:email-verify:{userId}      otp:phone-verify:{userId}      otp:password-reset:{userId}
```

```bash
# what the fixture runs under the hood (container name = $E2E_REDIS_CONTAINER):
docker exec server_2-redis-1 redis-cli GET "otp:email-verify:<userId>"
```

> ℹ️ **`email-otp/send` returns 500 locally** (placeholder Resend key) but the
> code is still written to Redis and the verify screen stays usable, so the
> journey completes. SMS uses a logger no-op (`phone-otp/send` → 204) and
> `forgot-password` queues email via the outbox worker (→ 204).

### Rate limits

server_2 rate-limits are **IP-keyed** for public routes (login 5/15min,
password-reset 3/hr) and share the docker-gateway IP, so they accumulate across
runs. Both specs call `flushRateLimits()` (deletes `rate:login:*` /
`rate:password-reset:*`) in `beforeEach` for determinism. OTP-generation/
verification are user-keyed (fresh user per run) and need no cleanup.

### Reaching public auth forms

A *full* page load of a logged-out public route triggers the bootstrap
(`checkAuth → /users/me 401 → /auth/refresh 401 → auth:expired`), which
`ClientInit` turns into a redirect to `/login`. The fixtures therefore reach
`/register` and `/forgot-password` by **client-navigating from `/login`** (the
way a real user does), which doesn't re-run the bootstrap. See `openAuthForm`.
