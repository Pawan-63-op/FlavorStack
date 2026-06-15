import { Result } from '../../shared/Result';
import { PricingContext } from '../types/PricingContext';
import { PricingBreakdown } from '../value-objects/PricingBreakdown';

// Pure, stateless pricing pipeline (Commerce Phase 7) — no I/O. Implementations run an
// ordered sequence of stages (Subtotal -> Fee -> DeliveryFee -> Tax -> Total, §4.2) over
// a PricingContext and fold the results into an invariant-checked PricingBreakdown.
export interface IPricingCalculator {
  calculate(ctx: PricingContext): Result<PricingBreakdown>;
}
