import { Guard } from '../../../../domain/shared/Guard';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';

describe('Guard', () => {
  describe('againstNullOrUndefined', () => {
    it('should pass if value is not null or undefined', () => {
      const result = Guard.againstNullOrUndefined('hello', 'testArg');
      expect(result.isSuccess).toBe(true);
    });

    it('should fail if value is null', () => {
      const result = Guard.againstNullOrUndefined(null, 'testArg');
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
      expect((result.getError() as ValidationError).message).toBe('testArg is null or undefined');
    });

    it('should fail if value is undefined', () => {
      const result = Guard.againstNullOrUndefined(undefined, 'testArg');
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });
  });

  describe('againstNullOrUndefinedBulk', () => {
    it('should pass if all values are not null or undefined', () => {
      const result = Guard.againstNullOrUndefinedBulk([
        { value: 'hello', argName: 'arg1' },
        { value: 123, argName: 'arg2' }
      ]);
      expect(result.isSuccess).toBe(true);
    });

    it('should fail if any value is null or undefined', () => {
      const result = Guard.againstNullOrUndefinedBulk([
        { value: 'hello', argName: 'arg1' },
        { value: null, argName: 'arg2' }
      ]);
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
      expect((result.getError() as ValidationError).message).toBe('arg2 is null or undefined');
    });
  });

  describe('againstEmptyString', () => {
    it('should pass if value is a non-empty string', () => {
      const result = Guard.againstEmptyString('hello', 'testArg');
      expect(result.isSuccess).toBe(true);
    });

    it('should fail if value is an empty string', () => {
      const result = Guard.againstEmptyString('', 'testArg');
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
      expect((result.getError() as ValidationError).message).toBe('testArg is an empty string');
    });

    it('should fail if value is only whitespace', () => {
      const result = Guard.againstEmptyString('   ', 'testArg');
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('should fail if value is not a string', () => {
      const result = Guard.againstEmptyString(123, 'testArg');
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });
  });

  describe('againstAtLeast', () => {
    it('should pass if value is equal to or greater than minimum', () => {
      const result1 = Guard.againstAtLeast(5, 5, 'testArg');
      const result2 = Guard.againstAtLeast(5, 10, 'testArg');
      expect(result1.isSuccess).toBe(true);
      expect(result2.isSuccess).toBe(true);
    });

    it('should fail if value is less than minimum', () => {
      const result = Guard.againstAtLeast(5, 4, 'testArg');
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
      expect((result.getError() as ValidationError).message).toBe('testArg must be at least 5');
    });
  });

  describe('againstAtMost', () => {
    it('should pass if value is equal to or less than maximum', () => {
      const result1 = Guard.againstAtMost(5, 5, 'testArg');
      const result2 = Guard.againstAtMost(5, 2, 'testArg');
      expect(result1.isSuccess).toBe(true);
      expect(result2.isSuccess).toBe(true);
    });

    it('should fail if value is greater than maximum', () => {
      const result = Guard.againstAtMost(5, 6, 'testArg');
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
      expect((result.getError() as ValidationError).message).toBe('testArg must be at most 5');
    });
  });

  describe('inRange', () => {
    it('should pass if value is inside range', () => {
      const result1 = Guard.inRange(5, 1, 10, 'testArg');
      const result2 = Guard.inRange(1, 1, 10, 'testArg');
      const result3 = Guard.inRange(10, 1, 10, 'testArg');
      expect(result1.isSuccess).toBe(true);
      expect(result2.isSuccess).toBe(true);
      expect(result3.isSuccess).toBe(true);
    });

    it('should fail if value is below range', () => {
      const result = Guard.inRange(0, 1, 10, 'testArg');
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
      expect((result.getError() as ValidationError).message).toBe('testArg must be between 1 and 10');
    });

    it('should fail if value is above range', () => {
      const result = Guard.inRange(11, 1, 10, 'testArg');
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });
  });

  describe('isOneOf', () => {
    it('should pass if value is in list of valid values', () => {
      const result = Guard.isOneOf('apple', ['apple', 'banana', 'orange'], 'testArg');
      expect(result.isSuccess).toBe(true);
    });

    it('should fail if value is not in list of valid values', () => {
      const result = Guard.isOneOf('pear', ['apple', 'banana', 'orange'], 'testArg');
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
      expect((result.getError() as ValidationError).message).toBe('testArg must be one of: [apple, banana, orange]');
    });
  });
});
