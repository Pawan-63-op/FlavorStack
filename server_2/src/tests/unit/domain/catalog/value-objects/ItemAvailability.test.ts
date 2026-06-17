import { ItemAvailability } from '../../../../../domain/catalog/value-objects/ItemAvailability.vo';
import { ValidationError } from '../../../../../domain/shared/errors/ValidationError';

describe('ItemAvailability Value Object', () => {
  it('should create a simple available item', () => {
    const result = ItemAvailability.create({ isAvailable: true });
    expect(result.isSuccess).toBe(true);
    expect(result.getValue().isAvailable).toBe(true);
  });

  it('should create an unavailable item with a reason', () => {
    const result = ItemAvailability.create({ isAvailable: false, outOfStockReason: 'Sold out' });
    expect(result.isSuccess).toBe(true);
    expect(result.getValue().outOfStockReason).toBe('Sold out');
  });

  it('should fail when availableFrom is after availableUntil', () => {
    const result = ItemAvailability.create({
      isAvailable: true,
      availableFrom: new Date('2026-06-15T10:00:00Z'),
      availableUntil: new Date('2026-06-15T08:00:00Z'),
    });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });

  it('should accept a valid availability window', () => {
    const result = ItemAvailability.create({
      isAvailable: true,
      availableFrom: new Date('2026-06-15T08:00:00Z'),
      availableUntil: new Date('2026-06-15T10:00:00Z'),
    });

    expect(result.isSuccess).toBe(true);
  });

  it('isAvailableAt should respect the availability window and isAvailable flag', () => {
    const availability = ItemAvailability.create({
      isAvailable: true,
      availableFrom: new Date('2026-06-15T08:00:00Z'),
      availableUntil: new Date('2026-06-15T10:00:00Z'),
    }).getValue();

    expect(availability.isAvailableAt(new Date('2026-06-15T09:00:00Z'))).toBe(true);
    expect(availability.isAvailableAt(new Date('2026-06-15T11:00:00Z'))).toBe(false);
  });

  it('isAvailableAt should return false when isAvailable flag is false regardless of window', () => {
    const availability = ItemAvailability.create({
      isAvailable: false,
      availableFrom: new Date('2026-06-15T08:00:00Z'),
      availableUntil: new Date('2026-06-15T10:00:00Z'),
    }).getValue();

    expect(availability.isAvailableAt(new Date('2026-06-15T09:00:00Z'))).toBe(false);
  });

  it('should fail when outOfStockReason is provided but isAvailable is true', () => {
    const result = ItemAvailability.create({ isAvailable: true, outOfStockReason: 'Sold out' });
    expect(result.isFailure).toBe(true);
  });
});
