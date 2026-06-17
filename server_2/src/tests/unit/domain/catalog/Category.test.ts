import { Category } from '../../../../domain/catalog/entities/Category';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';

describe('Category entity', () => {
  const baseProps = { restaurantId: 'rest-1', label: 'Starters', sortOrder: 0 };

  it('creates a valid category with isActive defaulting to true', () => {
    const result = Category.create(baseProps);
    expect(result.isSuccess).toBe(true);

    const category = result.getValue();
    expect(category.restaurantId).toBe('rest-1');
    expect(category.label).toBe('Starters');
    expect(category.sortOrder).toBe(0);
    expect(category.isActive).toBe(true);
  });

  it('allows isActive to be set explicitly on create', () => {
    const result = Category.create({ ...baseProps, isActive: false });
    expect(result.getValue().isActive).toBe(false);
  });

  it('rejects an empty label', () => {
    const result = Category.create({ ...baseProps, label: '   ' });
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });

  it('rejects a negative sortOrder', () => {
    const result = Category.create({ ...baseProps, sortOrder: -1 });
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });

  it('updates the label', () => {
    const category = Category.create(baseProps).getValue();
    const result = category.updateLabel('Mains');
    expect(result.isSuccess).toBe(true);
    expect(category.label).toBe('Mains');
  });

  it('rejects an empty label on update and leaves the label unchanged', () => {
    const category = Category.create(baseProps).getValue();
    const result = category.updateLabel('   ');
    expect(result.isFailure).toBe(true);
    expect(category.label).toBe('Starters');
  });

  it('updates the sortOrder', () => {
    const category = Category.create(baseProps).getValue();
    const result = category.updateSortOrder(5);
    expect(result.isSuccess).toBe(true);
    expect(category.sortOrder).toBe(5);
  });

  it('rejects a negative sortOrder on update', () => {
    const category = Category.create(baseProps).getValue();
    const result = category.updateSortOrder(-3);
    expect(result.isFailure).toBe(true);
    expect(category.sortOrder).toBe(0);
  });

  it('activates and deactivates the category', () => {
    const category = Category.create({ ...baseProps, isActive: false }).getValue();
    expect(category.isActive).toBe(false);

    category.activate();
    expect(category.isActive).toBe(true);

    category.deactivate();
    expect(category.isActive).toBe(false);
  });
});
