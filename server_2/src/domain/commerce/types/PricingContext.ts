// Input contract for IPricingCalculator (Commerce Phase 7) — a pure, Money-based
// description of everything the pricing pipeline needs to derive a PricingBreakdown
// for one checkout/preview. Built by the application layer (Checkout/PreviewCheckout,
// Phase 11/13) from the Cart plus the authoritative Catalog ACL read (Phase 10).
//
// `promotion` (Phase 8) is the AppliedPromotion resolved by IPromotionService at
// cart-apply time and recomputed authoritatively at checkout. When absent, the
// PromotionStage contributes a zero discount and PricingBreakdown.discount is zero.

import { Money } from '../../shared/Money';
import { Quantity } from '../value-objects/Quantity';
import { AppliedPromotion } from '../value-objects/AppliedPromotion';

export interface PricingLineVariantInput {
  optionId: string;
  priceDelta: Money;
}

export interface PricingLineInput {
  menuItemId: string;
  basePrice: Money;
  selectedVariants: PricingLineVariantInput[];
  quantity: Quantity;
}

export interface RestaurantFeeInputs {
  platformFee: Money;
  packagingFee: Money;
}

export interface DeliveryFeeTierInput {
  maxDistanceMeters: number;
  fee: Money;
}

export interface DeliveryFeeInput {
  distanceMeters: number;
  feeTiers: DeliveryFeeTierInput[];
  freeAboveSubtotal?: Money;
}

export interface TaxPolicy {
  rate: number; // decimal rate (e.g. 0.05 = 5%) applied to the taxable base by TaxStage
}

export interface PricingContext {
  lines: PricingLineInput[];
  restaurantFeeInputs: RestaurantFeeInputs;
  deliveryInputs: DeliveryFeeInput;
  taxPolicy: TaxPolicy;
  promotion?: AppliedPromotion;
}
