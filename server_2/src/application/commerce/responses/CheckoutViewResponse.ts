import { PricingBreakdown } from '../../../domain/commerce/value-objects/PricingBreakdown';
import { CheckoutAssembly } from '../services/CheckoutContextAssembler';

export interface MoneyResponse {
  amount: number;
  currency: string;
}

export interface CheckoutOptionView {
  optionId: string;
  label: string;
  priceDelta: MoneyResponse;
}

export interface CheckoutLineView {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: MoneyResponse;
  lineTotal: MoneyResponse;
  selectedOptions: CheckoutOptionView[];
}

export interface CheckoutPricingView {
  subtotal: MoneyResponse;
  fees: { type: string; amount: MoneyResponse }[];
  discount: MoneyResponse;
  tax: MoneyResponse;
  total: MoneyResponse;
}

export interface CheckoutPromotionView {
  code: string;
  discount: MoneyResponse;
}

export interface CheckoutViewResponse {
  restaurantId: string;
  lines: CheckoutLineView[];
  pricing: CheckoutPricingView;
  serviceable: boolean;
  distanceMeters: number;
  deliveryFee: MoneyResponse;
  minOrder: MoneyResponse;
  promotion: CheckoutPromotionView | null;
}

function money(amount: number, currency: string): MoneyResponse {
  return { amount, currency };
}

export function toCheckoutViewResponse(assembly: CheckoutAssembly, breakdown: PricingBreakdown): CheckoutViewResponse {
  const lines: CheckoutLineView[] = assembly.resolvedLines.map((line) => {
    const currency = line.basePrice.currency;
    const unitAmount = line.basePrice.amount + line.selectedOptions.reduce((sum, o) => sum + o.priceDelta.amount, 0);
    return {
      menuItemId: line.menuItemId,
      name: line.name,
      quantity: line.quantity.value,
      unitPrice: money(unitAmount, currency),
      lineTotal: money(unitAmount * line.quantity.value, currency),
      selectedOptions: line.selectedOptions.map((o) => ({
        optionId: o.optionId,
        label: o.label,
        priceDelta: money(o.priceDelta.amount, o.priceDelta.currency),
      })),
    };
  });

  return {
    restaurantId: assembly.restaurant.restaurantId,
    lines,
    pricing: {
      subtotal: money(breakdown.subtotal.amount, breakdown.subtotal.currency),
      fees: breakdown.fees.map((fee) => ({ type: fee.type, amount: money(fee.amount.amount, fee.amount.currency) })),
      discount: money(breakdown.discount.amount, breakdown.discount.currency),
      tax: money(breakdown.tax.amount, breakdown.tax.currency),
      total: money(breakdown.total.amount, breakdown.total.currency),
    },
    serviceable: assembly.serviceability.serviceable,
    distanceMeters: assembly.serviceability.distanceMeters,
    deliveryFee: money(assembly.serviceability.deliveryFee.amount, assembly.serviceability.deliveryFee.currency),
    minOrder: money(assembly.serviceability.minOrder.amount, assembly.serviceability.minOrder.currency),
    promotion: assembly.promotion
      ? { code: assembly.promotion.code, discount: money(assembly.promotion.discount.amount, assembly.promotion.discount.currency) }
      : null,
  };
}
