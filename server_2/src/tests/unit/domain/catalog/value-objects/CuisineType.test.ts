import { CuisineType } from '../../../../../domain/catalog/value-objects/CuisineType.vo';
import { CUISINE_TYPE } from '../../../../../domain/catalog/enums/cuisine-type.enum';
import { ValidationError } from '../../../../../domain/shared/errors/ValidationError';

describe('CuisineType Value Object', () => {
  it('should create a valid cuisine type', () => {
    const result = CuisineType.create(CUISINE_TYPE.NORTH_INDIAN);
    expect(result.isSuccess).toBe(true);
    expect(result.getValue().value).toBe(CUISINE_TYPE.NORTH_INDIAN);
  });

  it('should fail for an unknown cuisine type', () => {
    const result = CuisineType.create('KLINGON_FOOD' as any);
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });

  it('should be equal when values match', () => {
    const a = CuisineType.create(CUISINE_TYPE.ITALIAN).getValue();
    const b = CuisineType.create(CUISINE_TYPE.ITALIAN).getValue();
    expect(a.equals(b)).toBe(true);
  });
});
