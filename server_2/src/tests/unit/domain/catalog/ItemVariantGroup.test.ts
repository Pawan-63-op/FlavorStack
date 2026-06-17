import { ItemVariantGroup } from '../../../../domain/catalog/entities/ItemVariantGroup';
import { ItemOption } from '../../../../domain/catalog/entities/ItemOption';
import { Money } from '../../../../domain/shared/Money';
import { VARIANT_SELECTION_TYPE } from '../../../../domain/catalog/enums/variant-selection-type.enum';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';

function buildOption(overrides: Partial<{ label: string; priceDelta: Money; isDefault: boolean; isAvailable: boolean }> = {}) {
  return ItemOption.create({
    label: 'Medium',
    priceDelta: Money.create(0).getValue(),
    ...overrides,
  }).getValue();
}

function buildGroupProps(overrides: Partial<{
  label: string;
  selectionType: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: ItemOption[];
}> = {}) {
  return {
    label: 'Size',
    selectionType: VARIANT_SELECTION_TYPE.SINGLE,
    required: true,
    minSelect: 1,
    maxSelect: 1,
    ...overrides,
  } as any;
}

describe('ItemVariantGroup entity', () => {
  describe('create', () => {
    it('creates a valid SINGLE required group', () => {
      const result = ItemVariantGroup.create(buildGroupProps());
      expect(result.isSuccess).toBe(true);

      const group = result.getValue();
      expect(group.label).toBe('Size');
      expect(group.selectionType).toBe(VARIANT_SELECTION_TYPE.SINGLE);
      expect(group.required).toBe(true);
      expect(group.minSelect).toBe(1);
      expect(group.maxSelect).toBe(1);
      expect(group.options).toEqual([]);
    });

    it('creates a valid MULTI optional group with options', () => {
      const options = [buildOption({ label: 'Cheese' }), buildOption({ label: 'Olives' })];
      const result = ItemVariantGroup.create(
        buildGroupProps({ label: 'Add-ons', selectionType: VARIANT_SELECTION_TYPE.MULTI, required: false, minSelect: 0, maxSelect: 2, options })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.getValue().options).toHaveLength(2);
    });

    it('rejects an empty label', () => {
      const result = ItemVariantGroup.create(buildGroupProps({ label: '   ' }));
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('rejects an invalid selectionType', () => {
      const result = ItemVariantGroup.create(buildGroupProps({ selectionType: 'BOGUS' }));
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('rejects minSelect > maxSelect', () => {
      const result = ItemVariantGroup.create(buildGroupProps({ minSelect: 2, maxSelect: 1 }));
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('rejects required group with minSelect 0', () => {
      const result = ItemVariantGroup.create(buildGroupProps({ required: true, minSelect: 0, maxSelect: 1 }));
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('rejects SINGLE selectionType with maxSelect > 1', () => {
      const result = ItemVariantGroup.create(
        buildGroupProps({ selectionType: VARIANT_SELECTION_TYPE.SINGLE, minSelect: 1, maxSelect: 2 })
      );
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('rejects negative minSelect/maxSelect', () => {
      const result = ItemVariantGroup.create(buildGroupProps({ required: false, minSelect: -1, maxSelect: 1 }));
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });
  });

  describe('option management', () => {
    it('adds an option', () => {
      const group = ItemVariantGroup.create(
        buildGroupProps({ selectionType: VARIANT_SELECTION_TYPE.MULTI, required: false, minSelect: 0, maxSelect: 2 })
      ).getValue();

      const result = group.addOption({ label: 'Cheese', priceDelta: Money.create(2000).getValue() });
      expect(result.isSuccess).toBe(true);
      expect(group.options).toHaveLength(1);
      expect(group.options[0].label).toBe('Cheese');
    });

    it('rejects adding an invalid option', () => {
      const group = ItemVariantGroup.create(
        buildGroupProps({ selectionType: VARIANT_SELECTION_TYPE.MULTI, required: false, minSelect: 0, maxSelect: 2 })
      ).getValue();

      const result = group.addOption({ label: '  ', priceDelta: Money.create(2000).getValue() });
      expect(result.isFailure).toBe(true);
      expect(group.options).toHaveLength(0);
    });

    it('updates an existing option', () => {
      const group = ItemVariantGroup.create(
        buildGroupProps({ selectionType: VARIANT_SELECTION_TYPE.MULTI, required: false, minSelect: 0, maxSelect: 2 })
      ).getValue();
      const option = group.addOption({ label: 'Cheese', priceDelta: Money.create(2000).getValue() }).getValue();

      const result = group.updateOption(option.id.toString(), { label: 'Extra Cheese', isAvailable: false });
      expect(result.isSuccess).toBe(true);
      expect(option.label).toBe('Extra Cheese');
      expect(option.isAvailable).toBe(false);
    });

    it('returns NotFoundError when updating an unknown option', () => {
      const group = ItemVariantGroup.create(
        buildGroupProps({ selectionType: VARIANT_SELECTION_TYPE.MULTI, required: false, minSelect: 0, maxSelect: 2 })
      ).getValue();

      const result = group.updateOption('missing-id', { label: 'X' });
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(NotFoundError);
    });

    it('removes an option', () => {
      const group = ItemVariantGroup.create(
        buildGroupProps({ selectionType: VARIANT_SELECTION_TYPE.MULTI, required: false, minSelect: 0, maxSelect: 2 })
      ).getValue();
      const option = group.addOption({ label: 'Cheese', priceDelta: Money.create(2000).getValue() }).getValue();

      const result = group.removeOption(option.id.toString());
      expect(result.isSuccess).toBe(true);
      expect(group.options).toHaveLength(0);
    });

    it('returns NotFoundError when removing an unknown option', () => {
      const group = ItemVariantGroup.create(
        buildGroupProps({ selectionType: VARIANT_SELECTION_TYPE.MULTI, required: false, minSelect: 0, maxSelect: 2 })
      ).getValue();

      const result = group.removeOption('missing-id');
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(NotFoundError);
    });
  });

  describe('validateSelectionCount', () => {
    it('accepts a count within [minSelect, maxSelect]', () => {
      const group = ItemVariantGroup.create(buildGroupProps()).getValue();
      expect(group.validateSelectionCount(1).isSuccess).toBe(true);
    });

    it('rejects a count below minSelect', () => {
      const group = ItemVariantGroup.create(buildGroupProps()).getValue();
      const result = group.validateSelectionCount(0);
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('rejects a count above maxSelect', () => {
      const group = ItemVariantGroup.create(
        buildGroupProps({ selectionType: VARIANT_SELECTION_TYPE.MULTI, required: false, minSelect: 0, maxSelect: 1 })
      ).getValue();
      const result = group.validateSelectionCount(2);
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });
  });

  describe('hasAvailableOption', () => {
    it('returns false when no options exist', () => {
      const group = ItemVariantGroup.create(buildGroupProps()).getValue();
      expect(group.hasAvailableOption()).toBe(false);
    });

    it('returns true when at least one option is available', () => {
      const options = [buildOption({ isAvailable: false }), buildOption({ label: 'Large', isAvailable: true })];
      const group = ItemVariantGroup.create(buildGroupProps({ options })).getValue();
      expect(group.hasAvailableOption()).toBe(true);
    });

    it('returns false when all options are unavailable', () => {
      const options = [buildOption({ isAvailable: false })];
      const group = ItemVariantGroup.create(buildGroupProps({ minSelect: 1, maxSelect: 1, options })).getValue();
      expect(group.hasAvailableOption()).toBe(false);
    });
  });
});
