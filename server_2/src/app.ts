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
