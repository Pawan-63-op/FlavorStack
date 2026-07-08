import { Request, Response, NextFunction } from 'express';

const HTML_TAG_REGEX = /<[^>]*>/g;
const FORBIDDEN_KEY_REGEX = /^\$|\./;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(HTML_TAG_REGEX, '');
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      value[i] = sanitizeValue(value[i]);
    }
    return value;
  }
  if (isPlainObject(value)) {
    sanitizeObject(value);
    return value;
  }
  return value;
}

function sanitizeObject(obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    if (FORBIDDEN_KEY_REGEX.test(key)) {
      delete obj[key];
      continue;
    }
    obj[key] = sanitizeValue(obj[key]);
  }
}

export function sanitize(req: Request, _res: Response, next: NextFunction): void {
  if (isPlainObject(req.body)) sanitizeObject(req.body);
  if (isPlainObject(req.query)) sanitizeObject(req.query as Record<string, unknown>);
  if (isPlainObject(req.params)) sanitizeObject(req.params as Record<string, unknown>);
  next();
}
