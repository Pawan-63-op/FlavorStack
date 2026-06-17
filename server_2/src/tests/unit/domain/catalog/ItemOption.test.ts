import { ItemOption } from '../../../../domain/catalog/entities/ItemOption';
import { Money } from '../../../../domain/shared/Money';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';

function buildProps(overrides: Partial<{ label: string; priceDelta: Money; isDefault: boolean; isAvailable: boolean }> = {}) {
  return {
    label: 'Large',
    priceDelta: Money.create(5000).getValue(),
    ...overrides,
  };
}

describe('ItemOption entity', () => {
  it('creates a valid option with defaults', () => {
    const result = ItemOption.create(buildProps());
    expect(result.isSuccess).toBe(true);

    const option = result.getValue();
    expect(option.label).toBe('Large');
    expect(option.priceDelta.amount).toBe(5000);
    expect(option.isDefault).toBe(false);
    expect(option.isAvailable).toBe(true);
  });

  it('allows isDefault and isAvailable to be set explicitly', () => {
    const option = ItemOption.create(buildProps({ isDefault: true, isAvailable: false })).getValue();
    expect(option.isDefault).toBe(true);
    expect(option.isAvailable).toBe(false);
  });

  it('rejects an empty label', () => {
    const result = ItemOption.create(buildProps({ label: '   ' }));
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });

  it('rejects a priceDelta that is not a Money value object', () => {
    const result = ItemOption.create({ label: 'Large', priceDelta: { amount: 100 } as any });
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });

  it('updates the label', () => {
    const option = ItemOption.create(buildProps()).getValue();
    const result = option.updateLabel('Extra Large');
    expect(result.isSuccess).toBe(true);
    expect(option.label).toBe('Extra Large');
  });

  it('rejects an empty label on update and leaves the label unchanged', () => {
    const option = ItemOption.create(buildProps()).getValue();
    const result = option.updateLabel('  ');
    expect(result.isFailure).toBe(true);
    expect(option.label).toBe('Large');
  });

  it('updates the priceDelta', () => {
    const option = ItemOption.create(buildProps()).getValue();
    const newDelta = Money.create(7500).getValue();
    const result = option.updatePriceDelta(newDelta);
    expect(result.isSuccess).toBe(true);
    expect(option.priceDelta.amount).toBe(7500);
  });

  it('rejects a non-Money priceDelta on update', () => {
    const option = ItemOption.create(buildProps()).getValue();
    const result = option.updatePriceDelta({ amount: 100 } as any);
    expect(result.isFailure).toBe(true);
    expect(option.priceDelta.amount).toBe(5000);
  });

  it('toggles availability', () => {
    const option = ItemOption.create(buildProps()).getValue();
    option.setAvailable(false);
    expect(option.isAvailable).toBe(false);
    option.setAvailable(true);
    expect(option.isAvailable).toBe(true);
  });

  it('sets default flag', () => {
    const option = ItemOption.create(buildProps()).getValue();
    option.setDefault(true);
    expect(option.isDefault).toBe(true);
  });
});
