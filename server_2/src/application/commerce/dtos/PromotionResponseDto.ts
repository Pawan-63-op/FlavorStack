// Output DTO: ValidatePromotion — the resolved AppliedPromotion preview returned before the
// customer commits it to the cart. `applicable` is always true on success (a non-applicable
// code fails with a domain error mapped to HTTP by the error middleware).
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
