import { IdempotencyKey } from '../../../../../domain/commerce/value-objects/IdempotencyKey';

const UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('IdempotencyKey value object', () => {
  describe('create', () => {
    it('accepts a well-formed UUID', () => {
      const result = IdempotencyKey.create(UUID);
      expect(result.isSuccess).toBe(true);
      expect(result.getValue().value).toBe(UUID);
    });

    it('normalizes an upper-case UUID to lower-case', () => {
      const result = IdempotencyKey.create(UUID.toUpperCase());
      expect(result.isSuccess).toBe(true);
      expect(result.getValue().value).toBe(UUID);
    });

    it('rejects a non-UUID string', () => {
      const result = IdempotencyKey.create('not-a-uuid');
      expect(result.isFailure).toBe(true);
    });

    it('rejects an empty string', () => {
      const result = IdempotencyKey.create('');
      expect(result.isFailure).toBe(true);
    });
  });

  describe('generate', () => {
    it('produces a valid, unique key each call', () => {
      const a = IdempotencyKey.generate();
      const b = IdempotencyKey.generate();
      expect(IdempotencyKey.create(a.value).isSuccess).toBe(true);
      expect(a.value).not.toBe(b.value);
    });
  });

  describe('equals', () => {
    it('treats two keys with the same value as equal', () => {
      const a = IdempotencyKey.create(UUID).getValue();
      const b = IdempotencyKey.create(UUID.toUpperCase()).getValue();
      expect(a.equals(b)).toBe(true);
    });
  });
});
