import { Email } from '../../../../../domain/identity/value-objects/Email.vo';
import { ValidationError } from '../../../../../domain/shared/errors/ValidationError';

describe('Email Value Object', () => {
  it('should create a valid email successfully', () => {
    const emailResult = Email.create('test@example.com');
    expect(emailResult.isSuccess).toBe(true);
    expect(emailResult.getValue().value).toBe('test@example.com');
    expect(emailResult.getValue().toString()).toBe('test@example.com');
  });

  it('should trim and normalize email to lowercase', () => {
    const emailResult = Email.create('  Test.User@Example.Co.In  ');
    expect(emailResult.isSuccess).toBe(true);
    expect(emailResult.getValue().value).toBe('test.user@example.co.in');
  });

  it('should fail if email is empty', () => {
    const emailResult = Email.create('');
    expect(emailResult.isFailure).toBe(true);
    expect(emailResult.getError()).toBeInstanceOf(ValidationError);
  });

  it('should fail if email is missing @ symbol', () => {
    const emailResult = Email.create('testexample.com');
    expect(emailResult.isFailure).toBe(true);
    expect(emailResult.getError()).toBeInstanceOf(ValidationError);
  });

  it('should fail if email has no TLD or invalid format', () => {
    const emailResult1 = Email.create('test@example');
    const emailResult2 = Email.create('test@.com');
    expect(emailResult1.isFailure).toBe(true);
    expect(emailResult2.isFailure).toBe(true);
  });
});
