import { Fee } from '../../../../../domain/commerce/value-objects/Fee';
import { Money } from '../../../../../domain/shared/Money';
import { FEE_TYPE } from '../../../../../domain/commerce/enums/fee-type.enum';
import { ValidationError } from '../../../../../domain/shared/errors/ValidationError';

describe('Fee value object', () => {
  describe('create', () => {
    it('creates a valid PLATFORM fee', () => {
      const amount = Money.create(5000, 'INR').getValue();
      const result = Fee.create({ type: FEE_TYPE.PLATFORM, amount });

      expect(result.isSuccess).toBe(true);
      const fee = result.getValue();
      expect(fee.type).toBe(FEE_TYPE.PLATFORM);
      expect(fee.amount.equals(amount)).toBe(true);
    });

    it('creates a valid PACKAGING fee', () => {
      const amount = Money.create(2000, 'INR').getValue();
      const result = Fee.create({ type: FEE_TYPE.PACKAGING, amount });

      expect(result.isSuccess).toBe(true);
      expect(result.getValue().type).toBe(FEE_TYPE.PACKAGING);
    });

    it('creates a valid DELIVERY fee', () => {
      const amount = Money.create(3000, 'INR').getValue();
      const result = Fee.create({ type: FEE_TYPE.DELIVERY, amount });

      expect(result.isSuccess).toBe(true);
      expect(result.getValue().type).toBe(FEE_TYPE.DELIVERY);
    });

    it('rejects an unknown fee type', () => {
      const amount = Money.create(1000, 'INR').getValue();
      const result = Fee.create({ type: 'SURGE' as any, amount });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('rejects a non-Money amount', () => {
      const result = Fee.create({ type: FEE_TYPE.PLATFORM, amount: 1000 as any });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });
  });

  describe('equals', () => {
    it('treats two fees with the same type and amount as equal', () => {
      const a = Fee.create({ type: FEE_TYPE.PLATFORM, amount: Money.create(1000, 'INR').getValue() }).getValue();
      const b = Fee.create({ type: FEE_TYPE.PLATFORM, amount: Money.create(1000, 'INR').getValue() }).getValue();

      expect(a.equals(b)).toBe(true);
    });

    it('treats fees with different types as not equal', () => {
      const amount = Money.create(1000, 'INR').getValue();
      const a = Fee.create({ type: FEE_TYPE.PLATFORM, amount }).getValue();
      const b = Fee.create({ type: FEE_TYPE.PACKAGING, amount }).getValue();

      expect(a.equals(b)).toBe(false);
    });

    it('treats fees with different amounts as not equal', () => {
      const a = Fee.create({ type: FEE_TYPE.PLATFORM, amount: Money.create(1000, 'INR').getValue() }).getValue();
      const b = Fee.create({ type: FEE_TYPE.PLATFORM, amount: Money.create(2000, 'INR').getValue() }).getValue();

      expect(a.equals(b)).toBe(false);
    });
  });
});
