// Zod schema validator — parses body/query/params
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export type ValidationTarget = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, target: ValidationTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      next(result.error);
      return;
    }

    if (target === 'query') {
      // Express 5 exposes req.query as a getter-only property
      Object.defineProperty(req, 'query', { value: result.data, writable: true, configurable: true });
    } else {
      req[target] = result.data;
    }

    next();
  };
}
