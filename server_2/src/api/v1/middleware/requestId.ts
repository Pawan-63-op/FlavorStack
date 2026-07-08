import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const inbound = req.headers['x-request-id'];
  const id = typeof inbound === 'string' && inbound.trim().length > 0 ? inbound : randomUUID();

  const userAgent = req.headers['user-agent'];
  const device = req.headers['x-device-id'];

  req.context = {
    requestId: id,
    ip: req.ip ?? req.socket?.remoteAddress ?? '',
    userAgent: typeof userAgent === 'string' ? userAgent : undefined,
    device: typeof device === 'string' ? device : undefined,
  };

  res.setHeader('x-request-id', id);
  next();
}
