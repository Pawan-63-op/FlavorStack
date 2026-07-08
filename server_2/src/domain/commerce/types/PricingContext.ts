
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
