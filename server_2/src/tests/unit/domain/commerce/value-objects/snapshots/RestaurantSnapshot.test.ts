import { RestaurantSnapshot } from '../../../../../../domain/commerce/value-objects/snapshots/RestaurantSnapshot';
import { Money } from '../../../../../../domain/shared/Money';
import { COMMERCE_RESTAURANT_STATUS } from '../../../../../../domain/commerce/enums/restaurant-status.enum';
import { COMMERCE_SNAPSHOT_SCHEMA_VERSION } from '../../../../../../domain/commerce/constants/snapshot-schema-version';

const money = (amount: number, currency = 'INR') => Money.create(amount, currency).getValue();

function validProps() {
  return {
    restaurantId: 'rest-1',
    name: 'Tasty Place',
    status: COMMERCE_RESTAURANT_STATUS.ACTIVE,
    openAtCheckout: true,
    deliveryFeeInputs: {
      feeTiers: [
        { maxDistanceMeters: 3000, fee: money(2000) },
        { maxDistanceMeters: 8000, fee: money(4000) },
      ],
      freeAboveSubtotal: money(50000),
    },
  };
}

describe('RestaurantSnapshot value object', () => {
  describe('create', () => {
    it('creates a valid snapshot with default schemaVersion', () => {
      const result = RestaurantSnapshot.create(validProps());

      expect(result.isSuccess).toBe(true);
      const snapshot = result.getValue();
      expect(snapshot.restaurantId).toBe('rest-1');
      expect(snapshot.name).toBe('Tasty Place');
      expect(snapshot.status).toBe(COMMERCE_RESTAURANT_STATUS.ACTIVE);
      expect(snapshot.openAtCheckout).toBe(true);
      expect(snapshot.deliveryFeeInputs.feeTiers).toHaveLength(2);
      expect(snapshot.deliveryFeeInputs.freeAboveSubtotal?.amount).toBe(50000);
      expect(snapshot.schemaVersion).toBe(COMMERCE_SNAPSHOT_SCHEMA_VERSION);
    });

    it('creates a valid snapshot without freeAboveSubtotal', () => {
      const props = validProps();
      delete (props.deliveryFeeInputs as any).freeAboveSubtotal;

      const result = RestaurantSnapshot.create(props);

      expect(result.isSuccess).toBe(true);
      expect(result.getValue().deliveryFeeInputs.freeAboveSubtotal).toBeUndefined();
    });

    it('rejects an empty restaurantId', () => {
      const result = RestaurantSnapshot.create({ ...validProps(), restaurantId: '' });
      expect(result.isFailure).toBe(true);
    });

    it('rejects an empty name', () => {
      const result = RestaurantSnapshot.create({ ...validProps(), name: '  ' });
      expect(result.isFailure).toBe(true);
    });

    it('rejects an invalid status', () => {
      const result = RestaurantSnapshot.create({ ...validProps(), status: 'BOGUS' as never });
      expect(result.isFailure).toBe(true);
    });

    it('rejects a non-boolean openAtCheckout', () => {
      const result = RestaurantSnapshot.create({ ...validProps(), openAtCheckout: 'yes' as never });
      expect(result.isFailure).toBe(true);
    });

    it('rejects an empty feeTiers array', () => {
      const result = RestaurantSnapshot.create({
        ...validProps(),
        deliveryFeeInputs: { feeTiers: [] },
      });
      expect(result.isFailure).toBe(true);
    });

    it('rejects non-increasing feeTiers', () => {
      const result = RestaurantSnapshot.create({
        ...validProps(),
        deliveryFeeInputs: {
          feeTiers: [
            { maxDistanceMeters: 5000, fee: money(2000) },
            { maxDistanceMeters: 3000, fee: money(4000) },
          ],
        },
      });
      expect(result.isFailure).toBe(true);
    });

    it('rejects a tier with a non-Money fee', () => {
      const result = RestaurantSnapshot.create({
        ...validProps(),
        deliveryFeeInputs: {
          feeTiers: [{ maxDistanceMeters: 3000, fee: 2000 as never }],
        },
      });
      expect(result.isFailure).toBe(true);
    });

    it('rejects a non-Money freeAboveSubtotal', () => {
      const result = RestaurantSnapshot.create({
        ...validProps(),
        deliveryFeeInputs: { ...validProps().deliveryFeeInputs, freeAboveSubtotal: 50000 as never },
      });
      expect(result.isFailure).toBe(true);
    });

    it('rejects a non-positive schemaVersion', () => {
      const result = RestaurantSnapshot.create({ ...validProps(), schemaVersion: 0 });
      expect(result.isFailure).toBe(true);
    });
  });

  describe('immutability', () => {
    it('is unaffected by mutating the input feeTiers array after creation', () => {
      const props = validProps();
      const snapshot = RestaurantSnapshot.create(props).getValue();

      props.deliveryFeeInputs.feeTiers.push({ maxDistanceMeters: 99999, fee: money(9999) });

      expect(snapshot.deliveryFeeInputs.feeTiers).toHaveLength(2);
    });

    it('returns defensive copies from the deliveryFeeInputs getter', () => {
      const snapshot = RestaurantSnapshot.create(validProps()).getValue();

      const inputs = snapshot.deliveryFeeInputs;
      inputs.feeTiers.push({ maxDistanceMeters: 99999, fee: money(9999) });
      inputs.feeTiers[0].maxDistanceMeters = 1;

      expect(snapshot.deliveryFeeInputs.feeTiers).toHaveLength(2);
      expect(snapshot.deliveryFeeInputs.feeTiers[0].maxDistanceMeters).toBe(3000);
    });
  });

  describe('equals', () => {
    it('treats two snapshots with the same values as equal', () => {
      const a = RestaurantSnapshot.create(validProps()).getValue();
      const b = RestaurantSnapshot.create(validProps()).getValue();
      expect(a.equals(b)).toBe(true);
    });
  });

  describe('round-trip JSON serialization', () => {
    it('reproduces an equal snapshot via toJSON/fromJSON', () => {
      const original = RestaurantSnapshot.create(validProps()).getValue();

      const json = original.toJSON();
      const rebuilt = RestaurantSnapshot.fromJSON(json).getValue();

      expect(rebuilt.equals(original)).toBe(true);
      expect(rebuilt.schemaVersion).toBe(original.schemaVersion);
    });

    it('round-trips a snapshot without freeAboveSubtotal', () => {
      const props = validProps();
      delete (props.deliveryFeeInputs as any).freeAboveSubtotal;
      const original = RestaurantSnapshot.create(props).getValue();

      const rebuilt = RestaurantSnapshot.fromJSON(original.toJSON()).getValue();

      expect(rebuilt.equals(original)).toBe(true);
      expect(rebuilt.deliveryFeeInputs.freeAboveSubtotal).toBeUndefined();
    });

    it('produces JSON-safe primitives', () => {
      const snapshot = RestaurantSnapshot.create(validProps()).getValue();
      const json = snapshot.toJSON();

      expect(() => JSON.stringify(json)).not.toThrow();
      expect(json.deliveryFeeInputs.feeTiers[0].fee).toEqual({ amount: 2000, currency: 'INR' });
    });
  });
});
