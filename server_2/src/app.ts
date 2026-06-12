// Creates Express app — mounts middleware, routes, error handler (no listen here)
import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { AppContainer } from './container';
import { createApiRouter } from './api/v1/routes';
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

  expressApp.use(notFound);
  expressApp.use(errorHandler);

  return expressApp;
}
