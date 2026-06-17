import { LineItemSelection } from '../../../../../domain/commerce/value-objects/LineItemSelection';
import { Quantity } from '../../../../../domain/commerce/value-objects/Quantity';
import { ValidationError } from '../../../../../domain/shared/errors/ValidationError';

describe('LineItemSelection value object', () => {
  describe('create', () => {
    it('creates a valid selection with a numeric quantity', () => {
      const result = LineItemSelection.create({
        menuItemId: 'menu-1',
        selectedOptionIds: ['opt-1', 'opt-2'],
        quantity: 2,
      });

      expect(result.isSuccess).toBe(true);
      const selection = result.getValue();
      expect(selection.menuItemId).toBe('menu-1');
      expect(selection.selectedOptionIds).toEqual(['opt-1', 'opt-2']);
      expect(selection.quantity.value).toBe(2);
    });

    it('creates a valid selection with a Quantity instance', () => {
      const qty = Quantity.create(3).getValue();
      const result = LineItemSelection.create({ menuItemId: 'menu-1', quantity: qty });

      expect(result.isSuccess).toBe(true);
      expect(result.getValue().quantity.value).toBe(3);
    });

    it('defaults selectedOptionIds to an empty array when omitted', () => {
      const result = LineItemSelection.create({ menuItemId: 'menu-1', quantity: 1 });

      expect(result.isSuccess).toBe(true);
      expect(result.getValue().selectedOptionIds).toEqual([]);
    });

    it('rejects an empty menuItemId', () => {
      const result = LineItemSelection.create({ menuItemId: '', quantity: 1 });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('rejects an invalid quantity', () => {
      const result = LineItemSelection.create({ menuItemId: 'menu-1', quantity: 0 });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('rejects a non-array selectedOptionIds', () => {
      const result = LineItemSelection.create({ menuItemId: 'menu-1', quantity: 1, selectedOptionIds: 'opt-1' as any });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });
  });

  describe('hasSameSelection', () => {
    it('returns true for the same menu item and option set regardless of order', () => {
      const a = LineItemSelection.create({ menuItemId: 'menu-1', selectedOptionIds: ['opt-1', 'opt-2'], quantity: 1 }).getValue();
      const b = LineItemSelection.create({ menuItemId: 'menu-1', selectedOptionIds: ['opt-2', 'opt-1'], quantity: 5 }).getValue();

      expect(a.hasSameSelection(b)).toBe(true);
    });

    it('returns false for different menu items', () => {
      const a = LineItemSelection.create({ menuItemId: 'menu-1', selectedOptionIds: [], quantity: 1 }).getValue();
      const b = LineItemSelection.create({ menuItemId: 'menu-2', selectedOptionIds: [], quantity: 1 }).getValue();

      expect(a.hasSameSelection(b)).toBe(false);
    });

    it('returns false for different option sets', () => {
      const a = LineItemSelection.create({ menuItemId: 'menu-1', selectedOptionIds: ['opt-1'], quantity: 1 }).getValue();
      const b = LineItemSelection.create({ menuItemId: 'menu-1', selectedOptionIds: ['opt-2'], quantity: 1 }).getValue();

      expect(a.hasSameSelection(b)).toBe(false);
    });
  });
});
