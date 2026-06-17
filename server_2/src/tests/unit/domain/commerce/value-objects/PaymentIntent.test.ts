import { PaymentIntent } from '../../../../../domain/commerce/value-objects/PaymentIntent';
import { PAYMENT_METHOD } from '../../../../../domain/commerce/enums/payment-method.enum';

describe('PaymentIntent value object', () => {
  describe('create', () => {
    it('creates a valid intent for each supported method', () => {
      for (const method of Object.values(PAYMENT_METHOD)) {
        const result = PaymentIntent.create({ method });
        expect(result.isSuccess).toBe(true);
        expect(result.getValue().method).toBe(method);
      }
    });

    it('rejects an unsupported payment method', () => {
      const result = PaymentIntent.create({ method: 'BITCOIN' as never });
      expect(result.isFailure).toBe(true);
    });

    it('rejects a missing payment method', () => {
      const result = PaymentIntent.create({ method: undefined as never });
      expect(result.isFailure).toBe(true);
    });
  });

  describe('equals', () => {
    it('treats two intents with the same method as equal', () => {
      const a = PaymentIntent.create({ method: PAYMENT_METHOD.UPI }).getValue();
      const b = PaymentIntent.create({ method: PAYMENT_METHOD.UPI }).getValue();
      expect(a.equals(b)).toBe(true);
    });

    it('treats intents with different methods as not equal', () => {
      const a = PaymentIntent.create({ method: PAYMENT_METHOD.UPI }).getValue();
      const b = PaymentIntent.create({ method: PAYMENT_METHOD.COD }).getValue();
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('toJSON', () => {
    it('serializes to a plain { method } object', () => {
      const intent = PaymentIntent.create({ method: PAYMENT_METHOD.CARD }).getValue();
      expect(intent.toJSON()).toEqual({ method: 'CARD' });
      expect(() => JSON.stringify(intent.toJSON())).not.toThrow();
    });
  });
});
