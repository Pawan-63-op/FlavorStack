import { CorsOptions } from 'cors';

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:3000'];

export function getAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS;
  if (!raw) return DEFAULT_ALLOWED_ORIGINS;

  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : DEFAULT_ALLOWED_ORIGINS;
}

export function getCorsOptions(): CorsOptions {
  const allowedOrigins = getAllowedOrigins();

  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  };
}
