import { VariantSnapshot } from '../../../../../../domain/commerce/value-objects/snapshots/VariantSnapshot';
import { Money } from '../../../../../../domain/shared/Money';
import { COMMERCE_SNAPSHOT_SCHEMA_VERSION } from '../../../../../../domain/commerce/constants/snapshot-schema-version';

const money = (amount: number, currency = 'INR') => Money.create(amount, currency).getValue();

function validProps() {
  return {
    optionId: 'opt-extra-cheese',
    label: 'Extra Cheese',
    priceDelta: money(5000),
  };
}

describe('VariantSnapshot value object', () => {
  describe('create', () => {
    it('creates a valid snapshot with default schemaVersion', () => {
      const result = VariantSnapshot.create(validProps());

      expect(result.isSuccess).toBe(true);
      const snapshot = result.getValue();
      expect(snapshot.optionId).toBe('opt-extra-cheese');
      expect(snapshot.label).toBe('Extra Cheese');
      expect(snapshot.priceDelta.amount).toBe(5000);
      expect(snapshot.schemaVersion).toBe(COMMERCE_SNAPSHOT_SCHEMA_VERSION);
    });

    it('accepts a zero priceDelta', () => {
      const result = VariantSnapshot.create({ ...validProps(), priceDelta: money(0) });
      expect(result.isSuccess).toBe(true);
      expect(result.getValue().priceDelta.amount).toBe(0);
    });

    it('rejects an empty optionId', () => {
      const result = VariantSnapshot.create({ ...validProps(), optionId: '' });
      expect(result.isFailure).toBe(true);
    });

    it('rejects an empty label', () => {
      const result = VariantSnapshot.create({ ...validProps(), label: '  ' });
      expect(result.isFailure).toBe(true);
    });

    it('rejects a non-Money priceDelta', () => {
      const result = VariantSnapshot.create({ ...validProps(), priceDelta: 5000 as never });
      expect(result.isFailure).toBe(true);
    });

    it('rejects a non-positive schemaVersion', () => {
      const result = VariantSnapshot.create({ ...validProps(), schemaVersion: 0 });
      expect(result.isFailure).toBe(true);
    });
  });

  describe('equals', () => {
    it('treats two snapshots with the same values as equal', () => {
      const a = VariantSnapshot.create(validProps()).getValue();
      const b = VariantSnapshot.create(validProps()).getValue();
      expect(a.equals(b)).toBe(true);
    });
  });

  describe('round-trip JSON serialization', () => {
    it('reproduces an equal snapshot via toJSON/fromJSON', () => {
      const original = VariantSnapshot.create(validProps()).getValue();

      const rebuilt = VariantSnapshot.fromJSON(original.toJSON()).getValue();

      expect(rebuilt.equals(original)).toBe(true);
    });

    it('produces JSON-safe primitives', () => {
      const snapshot = VariantSnapshot.create(validProps()).getValue();
      const json = snapshot.toJSON();

      expect(() => JSON.stringify(json)).not.toThrow();
      expect(json.priceDelta).toEqual({ amount: 5000, currency: 'INR' });
    });
  });
});
