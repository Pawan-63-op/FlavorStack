import { PhoneNumber } from '../../../../../domain/identity/value-objects/PhoneNumber.vo';
import { ValidationError } from '../../../../../domain/shared/errors/ValidationError';

describe('PhoneNumber Value Object', () => {
  it('should create a valid E.164 phone number successfully', () => {
    const phoneResult = PhoneNumber.create('+919876543210');
    expect(phoneResult.isSuccess).toBe(true);
    expect(phoneResult.getValue().value).toBe('+919876543210');
    expect(phoneResult.getValue().toString()).toBe('+919876543210');
  });

  it('should normalize and strip spaces, dashes, and parens', () => {
    const phoneResult = PhoneNumber.create(' +91 9876-543 (210) ');
    expect(phoneResult.isSuccess).toBe(true);
    expect(phoneResult.getValue().value).toBe('+919876543210');
  });

  it('should fail if phone number is empty', () => {
    const phoneResult = PhoneNumber.create('');
    expect(phoneResult.isFailure).toBe(true);
  });

  it('should fail if missing leading + sign', () => {
    const phoneResult = PhoneNumber.create('919876543210');
    expect(phoneResult.isFailure).toBe(true);
    expect(phoneResult.getError()).toBeInstanceOf(ValidationError);
  });

  it('should fail if number has invalid length (too short or too long)', () => {
    const phoneResultShort = PhoneNumber.create('+12345');
    const phoneResultLong = PhoneNumber.create('+12345678901234567');
    expect(phoneResultShort.isFailure).toBe(true);
    expect(phoneResultLong.isFailure).toBe(true);
  });

  it('should fail if number contains non-digit characters after +', () => {
    const phoneResult = PhoneNumber.create('+12345abc789');
    expect(phoneResult.isFailure).toBe(true);
  });
});
