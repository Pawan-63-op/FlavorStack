import { CatalogVisibility } from '../../../../../domain/catalog/value-objects/CatalogVisibility.vo';
import { CATALOG_VISIBILITY } from '../../../../../domain/catalog/enums/catalog-visibility.enum';
import { ValidationError } from '../../../../../domain/shared/errors/ValidationError';

describe('CatalogVisibility Value Object', () => {
  it('should create a valid visibility', () => {
    const result = CatalogVisibility.create(CATALOG_VISIBILITY.PUBLIC);
    expect(result.isSuccess).toBe(true);
    expect(result.getValue().value).toBe(CATALOG_VISIBILITY.PUBLIC);
  });

  it('should fail for an unknown visibility value', () => {
    const result = CatalogVisibility.create('SECRET' as any);
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });

  it('should expose isPublic helper', () => {
    expect(CatalogVisibility.create(CATALOG_VISIBILITY.PUBLIC).getValue().isPublic()).toBe(true);
    expect(CatalogVisibility.create(CATALOG_VISIBILITY.HIDDEN).getValue().isPublic()).toBe(false);
  });
});
