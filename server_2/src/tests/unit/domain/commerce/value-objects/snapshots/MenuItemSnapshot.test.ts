import { MenuItemSnapshot } from '../../../../../../domain/commerce/value-objects/snapshots/MenuItemSnapshot';
import { Money } from '../../../../../../domain/shared/Money';
import { COMMERCE_SNAPSHOT_SCHEMA_VERSION } from '../../../../../../domain/commerce/constants/snapshot-schema-version';

const money = (amount: number, currency = 'INR') => Money.create(amount, currency).getValue();

function validProps() {
  return {
    menuItemId: 'item-1',
    name: 'Margherita Pizza',
    basePrice: money(45000),
    categoryId: 'cat-pizza',
  };
}

describe('MenuItemSnapshot value object', () => {
  describe('create', () => {
    it('creates a valid snapshot with default schemaVersion', () => {
      const result = MenuItemSnapshot.create(validProps());

      expect(result.isSuccess).toBe(true);
      const snapshot = result.getValue();
      expect(snapshot.menuItemId).toBe('item-1');
      expect(snapshot.name).toBe('Margherita Pizza');
      expect(snapshot.basePrice.amount).toBe(45000);
      expect(snapshot.categoryId).toBe('cat-pizza');
      expect(snapshot.schemaVersion).toBe(COMMERCE_SNAPSHOT_SCHEMA_VERSION);
    });

    it('accepts an explicit schemaVersion', () => {
      const result = MenuItemSnapshot.create({ ...validProps(), schemaVersion: 2 });
      expect(result.isSuccess).toBe(true);
      expect(result.getValue().schemaVersion).toBe(2);
    });

    it('rejects an empty menuItemId', () => {
      const result = MenuItemSnapshot.create({ ...validProps(), menuItemId: '' });
      expect(result.isFailure).toBe(true);
    });

    it('rejects an empty name', () => {
      const result = MenuItemSnapshot.create({ ...validProps(), name: '   ' });
      expect(result.isFailure).toBe(true);
    });

    it('rejects a non-Money basePrice', () => {
      const result = MenuItemSnapshot.create({ ...validProps(), basePrice: 45000 as never });
      expect(result.isFailure).toBe(true);
    });

    it('rejects an empty categoryId', () => {
      const result = MenuItemSnapshot.create({ ...validProps(), categoryId: '' });
      expect(result.isFailure).toBe(true);
    });

    it('rejects a non-positive schemaVersion', () => {
      const result = MenuItemSnapshot.create({ ...validProps(), schemaVersion: -1 });
      expect(result.isFailure).toBe(true);
    });

    it('rejects a non-integer schemaVersion', () => {
      const result = MenuItemSnapshot.create({ ...validProps(), schemaVersion: 1.5 });
      expect(result.isFailure).toBe(true);
    });
  });

  describe('equals', () => {
    it('treats two snapshots with the same values as equal', () => {
      const a = MenuItemSnapshot.create(validProps()).getValue();
      const b = MenuItemSnapshot.create(validProps()).getValue();
      expect(a.equals(b)).toBe(true);
    });

    it('treats snapshots with different basePrice as not equal', () => {
      const a = MenuItemSnapshot.create(validProps()).getValue();
      const b = MenuItemSnapshot.create({ ...validProps(), basePrice: money(46000) }).getValue();
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('round-trip JSON serialization', () => {
    it('reproduces an equal snapshot via toJSON/fromJSON', () => {
      const original = MenuItemSnapshot.create(validProps()).getValue();

      const rebuilt = MenuItemSnapshot.fromJSON(original.toJSON()).getValue();

      expect(rebuilt.equals(original)).toBe(true);
    });

    it('preserves an explicit schemaVersion across the round-trip', () => {
      const original = MenuItemSnapshot.create({ ...validProps(), schemaVersion: 3 }).getValue();

      const rebuilt = MenuItemSnapshot.fromJSON(original.toJSON()).getValue();

      expect(rebuilt.schemaVersion).toBe(3);
      expect(rebuilt.equals(original)).toBe(true);
    });

    it('produces JSON-safe primitives', () => {
      const snapshot = MenuItemSnapshot.create(validProps()).getValue();
      const json = snapshot.toJSON();

      expect(() => JSON.stringify(json)).not.toThrow();
      expect(json.basePrice).toEqual({ amount: 45000, currency: 'INR' });
    });
  });
});
