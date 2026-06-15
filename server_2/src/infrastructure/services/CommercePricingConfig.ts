import { Money } from '../../domain/shared/Money';
import { Result } from '../../domain/shared/Result';
import { CommercePricingPolicy } from '../../domain/commerce/types/CommercePricingPolicy';

// Interim, in-memory Commerce pricing policy (Phase 11) — the platform/packaging fees and tax rate the
// pricing pipeline applies. Deliberately hard-coded like buildDefaultCommerceCoupons: it stands in for the
// per-restaurant / per-region fee config a later phase will own, and the use cases read it only through the
// CommercePricingPolicy shape, so swapping this for a real source touches nothing else.
//
// Construction failures here would be a programming error in the seed, not a runtime domain failure, so we
// throw fast rather than thread Result through composition.
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
