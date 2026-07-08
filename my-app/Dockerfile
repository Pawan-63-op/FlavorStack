# Phase 12, Batch 12.3 — `my-app` production image.
#
# Multi-stage Next.js build → standalone runtime (`output: 'standalone'` in
# next.config.ts). The runner ships only the traced standalone server + static
# assets, runs as a non-root user, and listens on :3000 inside the compose
# network — nginx (the single public origin) proxies `/` here and `/api/v1` +
# `/socket.io` to the api service, so the frozen `sameSite:'lax'` cookies work.
#
# `NEXT_PUBLIC_*` values are inlined into the client bundle at BUILD time
# (see lib/config/featureFlags.ts), so they are passed as build args here, not
# runtime env. `API_PROXY_TARGET` is the only meaningful runtime env (the
# next.config rewrite fallback); in prod nginx owns `/api/v1` routing.

# ── builder ──────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Build-time public config (inlined into the client bundle). Defaults mirror the
# same-origin prod topology + lib/config/featureFlags.ts shipped defaults.
ARG NEXT_PUBLIC_API_BASE_URL=/api/v1
# Empty → same-origin: the Socket.IO `/tracking` namespace connects to the page
# origin, which nginx proxies to api with the WS Upgrade headers.
ARG NEXT_PUBLIC_SOCKET_URL=
ARG NEXT_PUBLIC_FEATURE_NOTIFICATIONS=true
ARG NEXT_PUBLIC_FEATURE_REVIEWS=true
ARG NEXT_PUBLIC_FEATURE_ADMIN=true
ARG NEXT_PUBLIC_FEATURE_ADMIN_OPS=true
ARG NEXT_PUBLIC_FEATURE_TRACKING=false
ARG NEXT_PUBLIC_FEATURE_NEARBY=false
ARG NEXT_PUBLIC_FEATURE_PHONE_VERIFICATION=false
# next.config rewrite needs a defined target at build time; nginx owns routing
# in prod, so this is only a harmless fallback for the Next server itself.
ARG API_PROXY_TARGET=http://api:3000

ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL \
    NEXT_PUBLIC_FEATURE_NOTIFICATIONS=$NEXT_PUBLIC_FEATURE_NOTIFICATIONS \
    NEXT_PUBLIC_FEATURE_REVIEWS=$NEXT_PUBLIC_FEATURE_REVIEWS \
    NEXT_PUBLIC_FEATURE_ADMIN=$NEXT_PUBLIC_FEATURE_ADMIN \
    NEXT_PUBLIC_FEATURE_ADMIN_OPS=$NEXT_PUBLIC_FEATURE_ADMIN_OPS \
    NEXT_PUBLIC_FEATURE_TRACKING=$NEXT_PUBLIC_FEATURE_TRACKING \
    NEXT_PUBLIC_FEATURE_NEARBY=$NEXT_PUBLIC_FEATURE_NEARBY \
    NEXT_PUBLIC_FEATURE_PHONE_VERIFICATION=$NEXT_PUBLIC_FEATURE_PHONE_VERIFICATION \
    API_PROXY_TARGET=$API_PROXY_TARGET \
    NEXT_TELEMETRY_DISABLED=1

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── runner ───────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Non-root runtime.
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# Standalone output: the traced server, the static assets, and `public/`.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
