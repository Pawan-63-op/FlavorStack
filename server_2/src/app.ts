import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { AppContainer } from './container';
import { createApiRouter } from './api/v1/routes';
import { createHealthRoutes } from './api/v1/routes/health.routes';
import { requestId } from './api/v1/middleware/requestId';
import { sanitize } from './api/v1/middleware/sanitize';
import { notFound } from './api/v1/middleware/notFound';
import { errorHandler } from './api/v1/middleware/errorHandler';
import { getCorsOptions } from './config/cors';
import { getHelmetOptions } from './config/helmet';

const JSON_BODY_LIMIT = '10kb';

export function createApp(app: AppContainer): Express {
  const expressApp = express();

  // Behind a proxy the socket peer is the proxy, not the caller, so `req.ip` collapses to a
  // single address for EVERY visitor — and `rateLimiter.ts` keys unauthenticated routes on
  // `req.context.ip`. The practical effect on the hosted demo (browser → Vercel rewrite →
  // Render load balancer → here) is that the whole internet shares one login bucket of 5 per
  // 15 minutes, so a second visitor is locked out by the first. With this set, Express reads
  // the client address from `X-Forwarded-For` and each caller gets its own bucket.
  //
  // Trade-off: a client can spoof `X-Forwarded-For` and so dodge its own rate limit. That is
  // strictly better than the current behaviour, where one caller can lock out everyone else.
  // `TRUST_PROXY` allows a hop count (e.g. "1") where the exact chain is known.
  const trustProxy = process.env.TRUST_PROXY ?? 'true';
  expressApp.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy !== 'false');

  expressApp.use(helmet(getHelmetOptions()));
  expressApp.use(cors(getCorsOptions()));
  expressApp.use(cookieParser());
  expressApp.use(express.json({ limit: JSON_BODY_LIMIT }));
  expressApp.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));
  expressApp.use(requestId);
  expressApp.use(sanitize);

  expressApp.use('/api/v1', createApiRouter(app));

  // The only root-level routes in the app — operational surface, outside the versioned API.
  // Mounted after `requestId` so a failing probe still carries one.
  expressApp.use(
    createHealthRoutes({ connection: app.connection, redisClient: app.redisClient }),
  );

  expressApp.use(notFound);
  expressApp.use(errorHandler);

  return expressApp;
}
