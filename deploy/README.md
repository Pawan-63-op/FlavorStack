# FlavorStack — Production Deployment (same-origin HTTPS)

Phase 12, Batch 12.3. This directory holds the **production topology**: the two
production Dockerfiles' wiring, an nginx reverse proxy, and a full prod compose
stack with a Mongo replica set. It exists to make the frozen backend's cookies
work in production **without changing `server_2`**.

## Why same-origin is the *only* supported prod topology

`server_2` sets its auth cookies (`access_token`, `refresh_token`) with
`sameSite:'lax'` and `secure` (only under `NODE_ENV=production`) —
[`server_2/src/api/v1/http/cookies.ts`]. The backend is **frozen**: its
application/domain code (including cookie behaviour) does not change.

- A **separate** frontend domain (e.g. `app.flavorstack.com` calling
  `api.flavorstack.com`) would make every API call cross-site. Lax cookies are
  **not** sent on cross-site XHR/fetch, so the session would never stick. The
  fix would be `sameSite:'none'` — a **backend change**, which is out of scope.
- Therefore prod serves the FE **and** proxies `/api/v1` + Socket.IO under **one
  HTTPS origin** via nginx. The cookies are then first-party/same-site and "just
  work", and **CORS becomes moot** (the browser never makes a cross-origin
  request). The nginx config deliberately adds **no** `Access-Control-*` headers.

This is confirmed with the user and documented as the project's standing
constraint (see `my-app/integration_phases/Phase_12.md`, Batch 12.3).

## Topology

```
                       ┌──────────────────────────── one HTTPS origin ───────────────────────────┐
  browser ──TLS:443──▶ │ nginx                                                                     │
                       │   /            → my-app:3000   (Next.js standalone)                       │
                       │   /api/v1/*    → api:3000      (cookies + x-request-id passed untouched)  │
                       │   /socket.io/* → api:3000      (WebSocket Upgrade — /tracking namespace)  │
                       └───────────────────────────────────────────────────────────────────────────┘
   api ─▶ mongo (replicaSet rs0, via mongo-init) + redis
   workers: outbox · email · notification · fulfillment  (NODE_ENV=production)
```

Images:
- `api` ← `server_2/Dockerfile.prod` (compiled `dist/`, non-root, prod deps).
- 4 workers ← `server_2/Dockerfile.worker` (existing prod worker image; `WORKER_TYPE` selects the process).
- `my-app` ← `my-app/Dockerfile` (Next `output:'standalone'`, non-root).
- `nginx` ← `nginx:1.27-alpine` + mounted `nginx/nginx.prod.conf` + `nginx/certs`.

## Env matrix

| Service | Key vars |
|---|---|
| **api / workers** | `NODE_ENV=production` (→ `Secure` cookies), `MONGO_URI=…?replicaSet=rs0`, `REDIS_HOST=redis`, `ALLOWED_ORIGINS=<public origin>`, `REALTIME_CORS_ORIGIN=<public origin>`, plus the secrets from `server_2/.env` (`JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_BASE_URL`, JWT TTLs). |
| **my-app** (build args) | `NEXT_PUBLIC_API_BASE_URL=/api/v1`, `NEXT_PUBLIC_SOCKET_URL=` (empty → same-origin), `NEXT_PUBLIC_FEATURE_*` (defaults match `lib/config/featureFlags.ts`). |
| **my-app** (runtime) | `API_PROXY_TARGET=http://api:3000` (Next rewrite fallback only; nginx owns `/api/v1` in prod). |
| compose | `PUBLIC_ORIGIN` (defaults to `https://localhost`) — feeds `ALLOWED_ORIGINS` + `REALTIME_CORS_ORIGIN`. |

`server_2/.env` is gitignored. Document/derive the prod values from
`server_2/.env.example` (it now carries the prod block) and `my-app/.env.production.example`.

## Bring-up (local prod stack)

From the **repo root**:

```bash
# 1. TLS cert for the HTTPS edge (self-signed, local only).
./deploy/nginx/gen-cert.sh

# 2. Ensure server_2/.env exists with the prod secrets (JWT keypair etc.).
#    See server_2/.env.example (prod block) — at minimum a valid RS256
#    JWT_PRIVATE_KEY / JWT_PUBLIC_KEY pair and RESEND_API_KEY.

# 3. Build + start the whole stack.
docker compose -f deploy/docker-compose.prod.yml up -d --build

# 4. Readiness through nginx (replica set must be initialised first).
curl -k https://localhost/api/v1/catalog/restaurants     # expect HTTP 200
```

Then load `https://localhost/` in a browser (accept the self-signed cert).

## Cross-origin / cookie / refresh / WS smoke

`my-app/e2e/cross-origin.smoke.spec.ts` (tagged `@smoke`, Playwright project
`prod-smoke`) proves the same-origin assumption end-to-end against this stack:
login sets `Secure` cookies on the single origin, a guarded read succeeds, a
forced 401 triggers exactly one refresh on the path-scoped
`/api/v1/auth/refresh`, the `/tracking` Socket.IO namespace connects through
nginx, and logout clears the cookies.

It self-seeds a verified customer (register through nginx + flip
`isEmailVerified` in Mongo via `docker exec`), so set the Mongo container name
to **this** compose project's mongo container (default compose project = the
`deploy` directory name → `deploy-mongo-1`):

```bash
cd my-app
npx playwright install --with-deps chromium      # first run only

E2E_PROD_SMOKE=1 \
E2E_BASE_URL=https://localhost \
E2E_MONGO_CONTAINER=deploy-mongo-1 \
npm run test:e2e -- --project=prod-smoke
```

`E2E_PROD_SMOKE=1` disables the dev `next dev` web server (the prod stack serves
the FE through nginx); the `prod-smoke` project sets `ignoreHTTPSErrors:true` for
the self-signed cert.

## TLS in real production

`deploy/nginx/gen-cert.sh` is for the **local** HTTPS smoke only. In real prod,
provision managed/LetsEncrypt certificates (e.g. a cert-manager sidecar, an ACME
companion, or your cloud LB terminating TLS) and mount the real
`fullchain.pem` / `privkey.pem` into `/etc/nginx/certs`. Certificate renewal is
environment-specific and intentionally not automated here.

## Teardown

```bash
docker compose -f deploy/docker-compose.prod.yml down -v   # -v drops mongo/redis volumes
```
