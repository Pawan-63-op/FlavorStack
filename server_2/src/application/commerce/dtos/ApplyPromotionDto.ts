// Input DTO: ApplyPromotion / ValidatePromotion — { customerId, code }.
// customerId is always the authenticated actor (never request input).
export interface ApplyPromotionDto {
  customerId: string;
  code: string;
}

// Input DTO: RemovePromotion — { customerId }
export interface RemovePromotionDto {
  customerId: string;
}
