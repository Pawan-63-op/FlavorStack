import { z } from 'zod';

export const uuid = z.string().uuid('Invalid id format');

export const orderRequestIdParam = z.object({ id: uuid });
