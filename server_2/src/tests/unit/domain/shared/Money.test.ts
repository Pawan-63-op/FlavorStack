import { Money } from '../../../../domain/shared/Money';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';

describe('Money', () => {
  describe('creation', () => {
    it('should create Money successfully with integer amount and supported currency', () => {
      const moneyResult = Money.create(1000, 'INR');

      expect(moneyResult.isSuccess).toBe(true);
      const money = moneyResult.getValue();
      expect(money.amount).toBe(1000);
      expect(money.currency).toBe('INR');
    });

    it('should default currency to INR', () => {
      const moneyResult = Money.create(500);
      expect(moneyResult.isSuccess).toBe(true);
      expect(moneyResult.getValue().currency).toBe('INR');
    });

    it('should normalize currency string to uppercase', () => {
      const moneyResult = Money.create(500, 'inr');
      expect(moneyResult.isSuccess).toBe(true);
      expect(moneyResult.getValue().currency).toBe('INR');
    });

    it('should reject non-integer amounts', () => {
      const moneyResult = Money.create(100.5, 'INR');
      expect(moneyResult.isFailure).toBe(true);
      expect(moneyResult.getError()).toBeInstanceOf(ValidationError);
      expect((moneyResult.getError() as ValidationError).message).toBe('Amount must be an integer representing paise/cents');
    });

    it('should reject negative amounts on creation', () => {
      const moneyResult = Money.create(-100, 'INR');
      expect(moneyResult.isFailure).toBe(true);
      expect(moneyResult.getError()).toBeInstanceOf(ValidationError);
    });

    it('should reject NaN or non-number amounts', () => {
      const moneyResult1 = Money.create(NaN, 'INR');
      const moneyResult2 = Money.create('100' as any, 'INR');

      expect(moneyResult1.isFailure).toBe(true);
      expect(moneyResult2.isFailure).toBe(true);
    });

    it('should reject unsupported currencies', () => {
      const moneyResult = Money.create(100, 'XYZ');
      expect(moneyResult.isFailure).toBe(true);
      expect(moneyResult.getError()).toBeInstanceOf(ValidationError);
      expect((moneyResult.getError() as ValidationError).message).toContain('Unsupported or unknown currency');
    });
  });

  describe('arithmetic operations', () => {
    it('should add two money values of same currency', () => {
      const m1 = Money.create(1000, 'INR').getValue();
      const m2 = Money.create(500, 'INR').getValue();

      const result = m1.add(m2);

      expect(result.isSuccess).toBe(true);
      expect(result.getValue().amount).toBe(1500);
      expect(result.getValue().currency).toBe('INR');
    });

    it('should reject addition with currency mismatch', () => {
      const m1 = Money.create(1000, 'INR').getValue();
      const m2 = Money.create(500, 'USD').getValue();

      const result = m1.add(m2);

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('should subtract two money values of same currency', () => {
      const m1 = Money.create(1000, 'INR').getValue();
      const m2 = Money.create(400, 'INR').getValue();

      const result = m1.subtract(m2);

      expect(result.isSuccess).toBe(true);
      expect(result.getValue().amount).toBe(600);
    });

    it('should reject subtraction resulting in negative balance', () => {
      const m1 = Money.create(1000, 'INR').getValue();
      const m2 = Money.create(1500, 'INR').getValue();

      const result = m1.subtract(m2);

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
      expect((result.getError() as ValidationError).message).toBe('Resulting money amount cannot be negative');
    });

    it('should reject subtraction with currency mismatch', () => {
      const m1 = Money.create(1000, 'INR').getValue();
      const m2 = Money.create(400, 'USD').getValue();

      const result = m1.subtract(m2);

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('should multiply money by a factor and round to integer paise', () => {
      const m = Money.create(100, 'INR').getValue(); // 1.00 INR

      const multiplied1 = m.multiply(1.5); // 150
      const multiplied2 = m.multiply(0.333); // 33.3 -> 33

      expect(multiplied1.amount).toBe(150);
      expect(multiplied2.amount).toBe(33);
    });

    it('should throw when multiply factor is negative', () => {
      const m = Money.create(100, 'INR').getValue();
      expect(() => m.multiply(-1.5)).toThrow('Factor cannot be negative');
    });
  });

  describe('comparisons and formatters', () => {
    it('should verify equality by value', () => {
      const m1 = Money.create(1000, 'INR').getValue();
      const m2 = Money.create(1000, 'INR').getValue();
      const m3 = Money.create(500, 'INR').getValue();

      expect(m1.equals(m2)).toBe(true);
      expect(m1.equals(m3)).toBe(false);
    });

    it('should verify greater than relation', () => {
      const m1 = Money.create(1000, 'INR').getValue();
      const m2 = Money.create(500, 'INR').getValue();

      expect(m1.isGreaterThan(m2)).toBe(true);
      expect(m2.isGreaterThan(m1)).toBe(false);
    });

    it('should throw on comparison currency mismatch', () => {
      const m1 = Money.create(1000, 'INR').getValue();
      const m2 = Money.create(500, 'USD').getValue();

      expect(() => m1.isGreaterThan(m2)).toThrow('Currency mismatch');
    });

    it('should convert amount to rupees / major unit correctly', () => {
      const m = Money.create(1050, 'INR').getValue();
      expect(m.toRupees()).toBe(10.5);
    });
  });
});
