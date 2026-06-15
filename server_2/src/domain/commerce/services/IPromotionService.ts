import { Result } from '../../shared/Result';
import { Money } from '../../shared/Money';
import { AppliedPromotion } from '../value-objects/AppliedPromotion';

// Promotion engine port (Commerce Phase 8, interim & extractable).
//
// `validate` resolves a raw promotion code against a PromotionContext into an
// AppliedPromotion (or a domain failure: not found / not eligible / min-order).
// It performs NO I/O on the Commerce hot path beyond the engine's own catalog
// lookup and is re-invoked at checkout to recompute the discount authoritatively.
//
// The context is intentionally minimal today (subtotal + currency) but is the
// single extension seam: customer/restaurant/line-level eligibility, stacking,
// and time windows are added here without touching callers — and the whole port
// lifts cleanly into a future Promotions context.
export interface PromotionContext {
  subtotal: Money;
  currency: string;
}

export interface IPromotionService {
  validate(code: string, ctx: PromotionContext): Result<AppliedPromotion>;
}
