// Zod validator for the OrderRequest query API (§9, Phase 13). Only the path param is validated;
// the customerId used for the ownership check comes from the authenticated actor, never the path.
import { z } from 'zod';

export const uuid = z.string().uuid('Invalid id format');

export const orderRequestIdParam = z.object({ id: uuid });
