import { DeliveryFeeStage } from '../../../../../../domain/commerce/services/pricing/DeliveryFeeStage';
import { Money } from '../../../../../../domain/shared/Money';
import { FEE_TYPE } from '../../../../../../domain/commerce/enums/fee-type.enum';
import { ValidationError } from '../../../../../../domain/shared/errors/ValidationError';

const money = (amount: number) => Money.create(amount, 'INR').getValue();

const tiers = [
  { maxDistanceMeters: 2000, fee: money(3000) },
  { maxDistanceMeters: 5000, fee: money(5000) },
  { maxDistanceMeters: 10000, fee: money(8000) },
];

describe('DeliveryFeeStage', () => {
  it('returns a DELIVERY fee', () => {
    const result = DeliveryFeeStage.run({ distanceMeters: 1500, feeTiers: tiers }, money(20000));

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().type).toBe(FEE_TYPE.DELIVERY);
    expect(result.getValue().amount.amount).toBe(3000);
  });

  it('selects the matching tier for a mid-range distance', () => {
    const result = DeliveryFeeStage.run({ distanceMeters: 4000, feeTiers: tiers }, money(20000));

    expect(result.getValue().amount.amount).toBe(5000);
  });

  it('includes the tier exactly at its maxDistanceMeters boundary', () => {
    const result = DeliveryFeeStage.run({ distanceMeters: 2000, feeTiers: tiers }, money(20000));

    expect(result.getValue().amount.amount).toBe(3000);
  });

  it('rolls to the next tier just past a boundary', () => {
    const result = DeliveryFeeStage.run({ distanceMeters: 2001, feeTiers: tiers }, money(20000));

    expect(result.getValue().amount.amount).toBe(5000);
  });

  it('falls back to the last tier when distance exceeds all tiers', () => {
    const result = DeliveryFeeStage.run({ distanceMeters: 99999, feeTiers: tiers }, money(20000));

    expect(result.getValue().amount.amount).toBe(8000);
  });

  it('charges zero when subtotal meets the free-above threshold exactly', () => {
    const result = DeliveryFeeStage.run(
      { distanceMeters: 4000, feeTiers: tiers, freeAboveSubtotal: money(50000) },
      money(50000)
    );

    expect(result.getValue().amount.amount).toBe(0);
  });

  it('charges zero when subtotal exceeds the free-above threshold', () => {
    const result = DeliveryFeeStage.run(
      { distanceMeters: 4000, feeTiers: tiers, freeAboveSubtotal: money(50000) },
      money(60000)
    );

    expect(result.getValue().amount.amount).toBe(0);
  });

  it('charges the tier fee when subtotal is below the free-above threshold', () => {
    const result = DeliveryFeeStage.run(
      { distanceMeters: 4000, feeTiers: tiers, freeAboveSubtotal: money(50000) },
      money(49999)
    );

    expect(result.getValue().amount.amount).toBe(5000);
  });

  it('fails when there are no tiers', () => {
    const result = DeliveryFeeStage.run({ distanceMeters: 1000, feeTiers: [] }, money(20000));

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });

  it('fails when tiers are not strictly increasing', () => {
    const badTiers = [
      { maxDistanceMeters: 5000, fee: money(3000) },
      { maxDistanceMeters: 2000, fee: money(5000) },
    ];
    const result = DeliveryFeeStage.run({ distanceMeters: 1000, feeTiers: badTiers }, money(20000));

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });

  it('fails when distanceMeters is negative', () => {
    const result = DeliveryFeeStage.run({ distanceMeters: -1, feeTiers: tiers }, money(20000));

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });
});
