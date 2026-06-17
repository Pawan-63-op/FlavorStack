import { DeliveryFeeMatrix } from '../../../../../domain/catalog/value-objects/DeliveryFeeMatrix.vo';
import { Money } from '../../../../../domain/shared/Money';
import { ValidationError } from '../../../../../domain/shared/errors/ValidationError';

const money = (paise: number) => Money.create(paise).getValue();

describe('DeliveryFeeMatrix Value Object', () => {
  const validTiers = [
    { maxDistanceMeters: 3000, fee: money(2000) },
    { maxDistanceMeters: 7000, fee: money(4000) },
    { maxDistanceMeters: 12000, fee: money(6000) },
  ];

  it('should create a valid fee matrix', () => {
    const result = DeliveryFeeMatrix.create({ tiers: validTiers });
    expect(result.isSuccess).toBe(true);
  });

  it('should fail with an empty tier list', () => {
    const result = DeliveryFeeMatrix.create({ tiers: [] });
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });

  it('should fail when maxDistanceMeters is not strictly increasing', () => {
    const tiers = [
      { maxDistanceMeters: 3000, fee: money(2000) },
      { maxDistanceMeters: 3000, fee: money(4000) },
    ];
    const result = DeliveryFeeMatrix.create({ tiers });
    expect(result.isFailure).toBe(true);
  });

  it('should fail when maxDistanceMeters is not positive', () => {
    const tiers = [{ maxDistanceMeters: 0, fee: money(2000) }];
    const result = DeliveryFeeMatrix.create({ tiers });
    expect(result.isFailure).toBe(true);
  });

  it('should resolve fee for a distance within a tier', () => {
    const matrix = DeliveryFeeMatrix.create({ tiers: validTiers }).getValue();

    expect(matrix.feeFor(1000, money(50000)).amount).toBe(2000);
    expect(matrix.feeFor(3000, money(50000)).amount).toBe(2000);
    expect(matrix.feeFor(5000, money(50000)).amount).toBe(4000);
  });

  it('should fall back to the last tier fee when distance exceeds all tiers', () => {
    const matrix = DeliveryFeeMatrix.create({ tiers: validTiers }).getValue();
    expect(matrix.feeFor(20000, money(50000)).amount).toBe(6000);
  });

  it('should return zero fee when subtotal meets the free-delivery threshold', () => {
    const matrix = DeliveryFeeMatrix.create({ tiers: validTiers, freeAboveSubtotal: money(50000) }).getValue();

    expect(matrix.feeFor(1000, money(50000)).amount).toBe(0);
    expect(matrix.feeFor(1000, money(49999)).amount).toBe(2000);
  });
});
