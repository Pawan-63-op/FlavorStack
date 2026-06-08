import { Result } from '../../../../src/domain/shared/Result';
import { ValidationError } from '../../../../src/domain/shared/errors/ValidationError';

describe('Result', () => {
  describe('success paths', () => {
    it('should create a successful result with a value', () => {
      const value = { name: 'FlavorStack' };
      const result = Result.ok(value);

      expect(result.isSuccess).toBe(true);
      expect(result.isFailure).toBe(false);
      expect(result.getValue()).toBe(value);
    });

    it('should create a successful result with no value', () => {
      const result = Result.ok();

      expect(result.isSuccess).toBe(true);
      expect(result.getValue()).toBeUndefined();
    });

    it('should throw when trying to get error of a success result', () => {
      const result = Result.ok('success');
      expect(() => result.getError()).toThrow('Cannot get error of a success result.');
    });
  });

  describe('failure paths', () => {
    it('should create a failure result with a string message', () => {
      const errorMessage = 'Something went wrong';
      const result = Result.fail<string>(errorMessage);

      expect(result.isSuccess).toBe(false);
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBe(errorMessage);
    });

    it('should create a failure result with a DomainError subclass', () => {
      const error = new ValidationError('Invalid name');
      const result = Result.fail<string>(error);

      expect(result.isSuccess).toBe(false);
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBe(error);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('should throw when trying to get value of a failure result', () => {
      const result = Result.fail('Operation failed');
      expect(() => result.getValue()).toThrow('Cannot get value of a failure result. Error: Operation failed');
    });
  });

  describe('combine', () => {
    it('should return success when all results are successful', () => {
      const r1 = Result.ok(1);
      const r2 = Result.ok('hello');
      const r3 = Result.ok(true);

      const combined = Result.combine([r1, r2, r3]);

      expect(combined.isSuccess).toBe(true);
    });

    it('should return the first failure result encountered', () => {
      const r1 = Result.ok(1);
      const r2 = Result.fail('First failure');
      const r3 = Result.fail('Second failure');

      const combined = Result.combine([r1, r2, r3]);

      expect(combined.isFailure).toBe(true);
      expect(combined.getError()).toBe('First failure');
    });
  });
});
