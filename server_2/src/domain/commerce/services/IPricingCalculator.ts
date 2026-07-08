import { Result } from '../../shared/Result';
import { PricingContext } from '../types/PricingContext';
import { PricingBreakdown } from '../value-objects/PricingBreakdown';

export interface IPricingCalculator {
  calculate(ctx: PricingContext): Result<PricingBreakdown>;
}
