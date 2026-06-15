// VO: { method: PaymentMethod } where method ∈ CARD | UPI | WALLET | COD — intent only, no charge execution
// (Commerce Phase 11, commerce_module.md §3.3). Carries the customer's chosen payment method onto the
// immutable OrderRequest; the future Payments context performs the actual charge.
import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { Guard } from '../../shared/Guard';
import { PAYMENT_METHOD, PaymentMethod } from '../enums/payment-method.enum';

interface PaymentIntentProps {
  method: PaymentMethod;
}

export interface PaymentIntentJSON {
  method: string;
}

export class PaymentIntent extends ValueObject<PaymentIntentProps> {
  private constructor(props: PaymentIntentProps) {
    super(props);
  }

  get method(): PaymentMethod {
    return this.props.method;
  }

  public static create(props: { method: PaymentMethod }): Result<PaymentIntent> {
    const validMethods = Object.values(PAYMENT_METHOD);
    const methodCheck = Guard.isOneOf(props.method, validMethods, 'PaymentMethod');
    if (methodCheck.isFailure) return Result.fail<PaymentIntent>(methodCheck.getError());

    return Result.ok<PaymentIntent>(new PaymentIntent({ method: props.method }));
  }

  public toJSON(): PaymentIntentJSON {
    return { method: this.props.method };
  }

  public static fromJSON(json: PaymentIntentJSON): Result<PaymentIntent> {
    return PaymentIntent.create({ method: json.method as PaymentMethod });
  }
}
