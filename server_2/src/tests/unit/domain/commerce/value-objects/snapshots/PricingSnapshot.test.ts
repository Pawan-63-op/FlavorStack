import { PricingSnapshot } from '../../../../../../domain/commerce/value-objects/snapshots/PricingSnapshot';
import { PricingBreakdown } from '../../../../../../domain/commerce/value-objects/PricingBreakdown';
import { Fee } from '../../../../../../domain/commerce/value-objects/Fee';
import { Money } from '../../../../../../domain/shared/Money';
import { FEE_TYPE } from '../../../../../../domain/commerce/enums/fee-type.enum';
import { COMMERCE_SNAPSHOT_SCHEMA_VERSION } from '../../../../../../domain/commerce/constants/snapshot-schema-version';

const money = (amount: number, currency = 'INR') => Money.create(amount, currency).getValue();

function fee(type: keyof typeof FEE_TYPE, amount: number, currency = 'INR') {
  return Fee.create({ type: FEE_TYPE[type], amount: money(amount, currency) }).getValue();
}

function validBreakdown(): PricingBreakdown {
  return PricingBreakdown.create({
    subtotal: money(1000),
    fees: [fee('PLATFORM', 50), fee('DELIVERY', 40)],
    discount: money(100),
    tax: money(50),
    total: money(1040), // 1000 + 50 + 40 - 100 + 50
  }).getValue();
}

describe('PricingSnapshot value object', () => {
  describe('create', () => {
    it('creates a valid snapshot with default schemaVersion', () => {
      const breakdown = validBreakdown();
      const result = PricingSnapshot.create({ pricing: breakdown });

      expect(result.isSuccess).toBe(true);
      const snapshot = result.getValue();
      expect(snapshot.pricing.equals(breakdown)).toBe(true);
      expect(snapshot.schemaVersion).toBe(COMMERCE_SNAPSHOT_SCHEMA_VERSION);
    });

    it('accepts an explicit schemaVersion', () => {
      const result = PricingSnapshot.create({ pricing: validBreakdown(), schemaVersion: 2 });
      expect(result.isSuccess).toBe(true);
      expect(result.getValue().schemaVersion).toBe(2);
    });

    it('rejects a non-PricingBreakdown pricing', () => {
      const result = PricingSnapshot.create({ pricing: {} as never });
      expect(result.isFailure).toBe(true);
    });

    it('rejects a non-positive schemaVersion', () => {
      const result = PricingSnapshot.create({ pricing: validBreakdown(), schemaVersion: 0 });
      expect(result.isFailure).toBe(true);
    });
  });

  describe('equals', () => {
    it('treats two snapshots with the same values as equal', () => {
      const a = PricingSnapshot.create({ pricing: validBreakdown() }).getValue();
      const b = PricingSnapshot.create({ pricing: validBreakdown() }).getValue();
      expect(a.equals(b)).toBe(true);
    });
  });

  describe('round-trip JSON serialization', () => {
    it('reproduces an equal snapshot via toJSON/fromJSON', () => {
      const original = PricingSnapshot.create({ pricing: validBreakdown() }).getValue();

      const rebuilt = PricingSnapshot.fromJSON(original.toJSON()).getValue();

      expect(rebuilt.equals(original)).toBe(true);
      expect(rebuilt.pricing.equals(original.pricing)).toBe(true);
    });

    it('round-trips a breakdown with no fees, discount, or tax', () => {
      const breakdown = PricingBreakdown.create({
        subtotal: money(500),
        fees: [],
        discount: money(0),
        tax: money(0),
        total: money(500),
      }).getValue();
      const original = PricingSnapshot.create({ pricing: breakdown }).getValue();

      const rebuilt = PricingSnapshot.fromJSON(original.toJSON()).getValue();

      expect(rebuilt.equals(original)).toBe(true);
      expect(rebuilt.pricing.fees).toHaveLength(0);
    });

    it('produces JSON-safe primitives', () => {
      const snapshot = PricingSnapshot.create({ pricing: validBreakdown() }).getValue();
      const json = snapshot.toJSON();

      expect(() => JSON.stringify(json)).not.toThrow();
      expect(json.pricing.total).toEqual({ amount: 1040, currency: 'INR' });
      expect(json.pricing.fees).toHaveLength(2);
    });
  });
});
