import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { ValidationError } from '../../shared/errors/ValidationError';
import { Money } from '../../shared/Money';
import { PROMOTION_KIND, PromotionKind } from '../enums/promotion-kind.enum';

// VO: { code, kind, discount: Money, sourceRef } — the resolved outcome of validating a
// promotion code against a cart/checkout context (Commerce Phase 8). One per Cart; produced
// by IPromotionService and re-validated/recomputed at checkout. `sourceRef` points back at
// the coupon (or future Promotion entity) that produced it, keeping the engine extractable
// to a future Promotions context with no Commerce rewrite.
interface AppliedPromotionProps {
  code: string;
  kind: PromotionKind;
  discount: Money;
  sourceRef: string;
}

export class AppliedPromotion extends ValueObject<AppliedPromotionProps> {
  private constructor(props: AppliedPromotionProps) {
    super(props);
  }

  get code(): string {
    return this.props.code;
  }

  get kind(): PromotionKind {
    return this.props.kind;
  }

  get discount(): Money {
    return this.props.discount;
  }

  get sourceRef(): string {
    return this.props.sourceRef;
  }

  public static create(props: {
    code: string;
    kind: PromotionKind;
    discount: Money;
    sourceRef: string;
  }): Result<AppliedPromotion> {
    if (!props.code || typeof props.code !== 'string' || props.code.trim().length === 0) {
      return Result.fail<AppliedPromotion>(new ValidationError('Promotion code must be a non-empty string'));
    }

    const validKinds = Object.values(PROMOTION_KIND) as string[];
    if (!validKinds.includes(props.kind)) {
      return Result.fail<AppliedPromotion>(
        new ValidationError(`Promotion kind must be one of: ${validKinds.join(', ')}`)
      );
    }

    if (!(props.discount instanceof Money)) {
      return Result.fail<AppliedPromotion>(new ValidationError('Promotion discount must be a valid Money value object'));
    }

    if (!props.sourceRef || typeof props.sourceRef !== 'string' || props.sourceRef.trim().length === 0) {
      return Result.fail<AppliedPromotion>(new ValidationError('Promotion sourceRef must be a non-empty string'));
    }

    return Result.ok<AppliedPromotion>(
      new AppliedPromotion({
        code: props.code.trim().toUpperCase(),
        kind: props.kind,
        discount: props.discount,
        sourceRef: props.sourceRef,
      })
    );
  }
}
