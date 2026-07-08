import { Result } from '../../shared/Result';
import { Money } from '../../shared/Money';
import { AppliedPromotion } from '../value-objects/AppliedPromotion';

export interface PromotionContext {
  subtotal: Money;
  currency: string;
}

export interface IPromotionService {
  validate(code: string, ctx: PromotionContext): Result<AppliedPromotion>;
}
