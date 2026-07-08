import { AppliedPromotion } from '../../../domain/commerce/value-objects/AppliedPromotion';
import { AppliedPromotionResponse } from './CartResponseDto';

export interface ValidatePromotionResponseDto {
  applicable: boolean;
  promotion: AppliedPromotionResponse;
}

export function toValidatePromotionResponse(promotion: AppliedPromotion): ValidatePromotionResponseDto {
  return {
    applicable: true,
    promotion: {
      code: promotion.code,
      kind: promotion.kind,
      discount: { amount: promotion.discount.amount, currency: promotion.discount.currency },
      sourceRef: promotion.sourceRef,
    },
  };
}
