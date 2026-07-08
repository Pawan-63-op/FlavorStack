import { Money } from '../../shared/Money';

export interface CommercePricingPolicy {
  platformFee: Money;
  packagingFee: Money;
  taxRate: number; // decimal rate (e.g. 0.05 = 5%) applied by TaxStage to the taxable base
}
