import { Money } from '../../domain/shared/Money';
import { Result } from '../../domain/shared/Result';
import { CommercePricingPolicy } from '../../domain/commerce/types/CommercePricingPolicy';

function ok<T>(label: string, value: Result<T>): T {
  if (value.isFailure) {
    const err = value.getError();
    throw new Error(`Invalid pricing config (${label}): ${typeof err === 'string' ? err : err.message}`);
  }
  return value.getValue();
}

export function buildDefaultCommercePricingPolicy(currency = 'INR'): CommercePricingPolicy {
  return {
    platformFee: ok('platformFee', Money.create(500, currency)), // ₹5.00
    packagingFee: ok('packagingFee', Money.create(300, currency)), // ₹3.00
    taxRate: 0.05, // 5%
  };
}
