import { FeeStage } from '../../../../../../domain/commerce/services/pricing/FeeStage';
import { Money } from '../../../../../../domain/shared/Money';
import { FEE_TYPE } from '../../../../../../domain/commerce/enums/fee-type.enum';
import { ValidationError } from '../../../../../../domain/shared/errors/ValidationError';

const money = (amount: number) => Money.create(amount, 'INR').getValue();

describe('FeeStage', () => {
  it('emits a PLATFORM and a PACKAGING fee from the inputs', () => {
    const result = FeeStage.run({ platformFee: money(5000), packagingFee: money(2000) });

    expect(result.isSuccess).toBe(true);
    const fees = result.getValue();
    expect(fees).toHaveLength(2);

    const platform = fees.find((f) => f.type === FEE_TYPE.PLATFORM);
    const packaging = fees.find((f) => f.type === FEE_TYPE.PACKAGING);
    expect(platform!.amount.amount).toBe(5000);
    expect(packaging!.amount.amount).toBe(2000);
  });

  it('emits both fees even when amounts are zero', () => {
    const result = FeeStage.run({ platformFee: money(0), packagingFee: money(0) });

    expect(result.isSuccess).toBe(true);
    const fees = result.getValue();
    expect(fees).toHaveLength(2);
    expect(fees.every((f) => f.amount.amount === 0)).toBe(true);
  });

  it('fails when platformFee is not Money', () => {
    const result = FeeStage.run({ platformFee: 5000 as any, packagingFee: money(2000) });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });

  it('fails when packagingFee is not Money', () => {
    const result = FeeStage.run({ platformFee: money(5000), packagingFee: undefined as any });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });
});
