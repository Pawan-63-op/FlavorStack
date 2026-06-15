// Commerce-owned pricing configuration (Commerce Phase 11) — the platform/packaging fees and tax rate
// that the pricing pipeline folds in, which are NOT sourced from Catalog (commerce_module.md §4.2; Phase 10
// Batch 2 reconciliation: "platform/packaging fees are Commerce pricing config"). Kept as a tiny injected
// policy object so the interim hard-coded values (see infrastructure/services/CommercePricingConfig.ts) can
// later become per-restaurant / per-region config without touching the pricing pipeline or the use cases.
import { Money } from '../../shared/Money';

export interface CommercePricingPolicy {
  platformFee: Money;
  packagingFee: Money;
  taxRate: number; // decimal rate (e.g. 0.05 = 5%) applied by TaxStage to the taxable base
}
