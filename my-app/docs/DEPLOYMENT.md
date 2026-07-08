# Deployment — same-origin HTTPS topology

> **Canonical reference:** [`/deploy/README.md`](../../deploy/README.md) holds the
> full bring-up steps, env matrix, smoke commands, and TLS notes. This page is a
> FE-developer-facing summary; keep them consistent.

## The constraint that shapes everything

`server_2` is **frozen**. It sets its auth cookies (`access_token`,
`refresh_token`) with `SameSite=Lax` and `Secure` (under `NODE_ENV=production`)
in `server_2/src/api/v1/http/cookies.ts`, and that behaviour does not change.

- **Lax cookies are not sent on cross-site requests.** A separate FE domain
  calling a separate API domain would lose the session on every call. The only
  fix would be `SameSite=None` — a backend change, **out of scope**.
- **Therefore production is single-origin.** nginx terminates TLS on one HTTPS
  origin and routes everything from there. The cookies are first-party, the
  refresh cookie's `/api/v1/auth/refresh` path scope lines up with the client's
  refresh call, and **CORS is moot** — nginx adds no `Access-Control-*` headers
  because the browser never makes a cross-origin request.

See `docs/AUTH_FLOWS.md` for how the lax/path-scoped cookies drive login and the
single-flight refresh.

## Topology at a glance

```
browser ──TLS:443──▶ nginx ──┬─ /            → my-app (Next.js standalone)
                             ├─ /api/v1/*    → api    (cookies + x-request-id untouched)
                             └─ /socket.io/* → api    (WebSocket Upgrade — /tracking)
api ─▶ mongo (replicaSet rs0) + redis ; workers: outbox · email · notification · fulfillment
```

All services run `NODE_ENV=production` (so cookies are `Secure`). The Mongo
**replica set** is required in every environment — transactions + the outbox
pattern depend on it.

## Images & files

| Piece | Source |
| ----- | ------ |
| FE | `my-app/Dockerfile` (Next `output:'standalone'`, non-root) |
| API | `server_2/Dockerfile.prod` (compiled `dist/`, non-root, prod deps) |
| Workers | `server_2/Dockerfile.worker` (`WORKER_TYPE` selects the process) |
| Reverse proxy | `deploy/nginx/nginx.prod.conf` + `deploy/nginx/certs` |
| Stack | `deploy/docker-compose.prod.yml` |

## FE env contract

- **Build args:** `NEXT_PUBLIC_API_BASE_URL=/api/v1`, `NEXT_PUBLIC_SOCKET_URL=`
  (empty → same-origin Socket.IO), and the `NEXT_PUBLIC_FEATURE_*` set (defaults
  mirror `lib/config/featureFlags.ts` — see `docs/FEATURE_FLAGS.md`).
- **Runtime:** `API_PROXY_TARGET=http://api:3000` is only the Next dev-rewrite
  fallback; in prod **nginx owns `/api/v1` routing** (the `next.config.ts`
  rewrite is a dev-only convenience).
- **Optional observability:** `NEXT_PUBLIC_SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_ENV`
  — unset = no-op reporter (Phase 12.4).
- Templates: `my-app/.env.production.example`, `server_2/.env.example` (prod block).

## Verifying the topology

```bash
# from repo root
./deploy/nginx/gen-cert.sh                                    # local self-signed TLS
docker compose -f deploy/docker-compose.prod.yml up -d --build
curl -k https://localhost/api/v1/catalog/restaurants          # → 200 through nginx
```

End-to-end proof is `my-app/e2e/cross-origin.smoke.spec.ts` (Playwright
`prod-smoke` project): `Secure` cookies on the single origin, one path-scoped
refresh on a forced 401, `/tracking` Socket.IO through nginx, logout clears
cookies, zero CORS errors. Run it with the `deploy-mongo-1` container name — see
[`/deploy/README.md`](../../deploy/README.md#cross-origin--cookie--refresh--ws-smoke).

## Real production TLS

The self-signed cert is **local-only**. In real prod, terminate TLS with managed
/ LetsEncrypt certificates and mount `fullchain.pem` / `privkey.pem` into
`/etc/nginx/certs`; renewal is environment-specific and intentionally not
automated here.
