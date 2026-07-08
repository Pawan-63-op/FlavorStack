import { TaxStage } from '../../../../../../domain/commerce/services/pricing/TaxStage';
import { Money } from '../../../../../../domain/shared/Money';
import { ValidationError } from '../../../../../../domain/shared/errors/ValidationError';

const money = (amount: number) => Money.create(amount, 'INR').getValue();

describe('TaxStage', () => {
  it('applies a positive rate to the taxable base', () => {
    const result = TaxStage.run(money(20000), { rate: 0.05 });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().amount).toBe(1000); // 20000 * 0.05
  });

  it('returns zero tax for a zero rate', () => {
    const result = TaxStage.run(money(20000), { rate: 0 });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().amount).toBe(0);
  });

  it('rounds to the nearest paise', () => {
    const result = TaxStage.run(money(19999), { rate: 0.05 });

    expect(result.getValue().amount).toBe(1000);
  });

  it('preserves the base currency', () => {
    const result = TaxStage.run(Money.create(20000, 'USD').getValue(), { rate: 0.1 });

    expect(result.getValue().currency).toBe('USD');
  });

  it('fails when the base is not Money', () => {
    const result = TaxStage.run(20000 as any, { rate: 0.05 });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });

  it('fails when the rate is negative', () => {
    const result = TaxStage.run(money(20000), { rate: -0.05 });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });

  it('fails when the rate is not a number', () => {
    const result = TaxStage.run(money(20000), { rate: undefined as any });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });
});
