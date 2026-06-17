import { Quantity } from '../../../../../domain/commerce/value-objects/Quantity';
import { ValidationError } from '../../../../../domain/shared/errors/ValidationError';

describe('Quantity value object', () => {
  describe('create', () => {
    it('creates a valid quantity within range', () => {
      const result = Quantity.create(3);

      expect(result.isSuccess).toBe(true);
      expect(result.getValue().value).toBe(3);
    });

    it('accepts the minimum value (1)', () => {
      const result = Quantity.create(1);

      expect(result.isSuccess).toBe(true);
      expect(result.getValue().value).toBe(1);
    });

    it('accepts the maximum value', () => {
      const result = Quantity.create(Quantity.MAX);

      expect(result.isSuccess).toBe(true);
      expect(result.getValue().value).toBe(Quantity.MAX);
    });

    it('rejects zero', () => {
      const result = Quantity.create(0);

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('rejects negative values', () => {
      const result = Quantity.create(-1);

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('rejects values above the maximum', () => {
      const result = Quantity.create(Quantity.MAX + 1);

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('rejects non-integer values', () => {
      const result = Quantity.create(1.5);

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });
  });

  describe('add', () => {
    it('adds two quantities together', () => {
      const a = Quantity.create(2).getValue();
      const b = Quantity.create(3).getValue();

      const result = a.add(b);

      expect(result.isSuccess).toBe(true);
      expect(result.getValue().value).toBe(5);
    });

    it('fails when the sum exceeds the maximum', () => {
      const a = Quantity.create(Quantity.MAX).getValue();
      const b = Quantity.create(1).getValue();

      const result = a.add(b);

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });
  });

  describe('equals', () => {
    it('treats two quantities with the same value as equal', () => {
      const a = Quantity.create(4).getValue();
      const b = Quantity.create(4).getValue();

      expect(a.equals(b)).toBe(true);
    });
  });
});
