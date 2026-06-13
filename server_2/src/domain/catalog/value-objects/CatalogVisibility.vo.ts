import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { ValidationError } from '../../shared/errors/ValidationError';
import { CATALOG_VISIBILITY, CatalogVisibility as CatalogVisibilityValue } from '../enums/catalog-visibility.enum';

interface CatalogVisibilityProps {
  value: CatalogVisibilityValue;
}

export class CatalogVisibility extends ValueObject<CatalogVisibilityProps> {
  private constructor(props: CatalogVisibilityProps) {
    super(props);
  }

  get value(): CatalogVisibilityValue {
    return this.props.value;
  }

  public static create(value: CatalogVisibilityValue): Result<CatalogVisibility> {
    if (!Object.values(CATALOG_VISIBILITY).includes(value)) {
      return Result.fail<CatalogVisibility>(new ValidationError(`Invalid catalog visibility: ${value}`));
    }
    return Result.ok<CatalogVisibility>(new CatalogVisibility({ value }));
  }

  public isPublic(): boolean {
    return this.props.value === CATALOG_VISIBILITY.PUBLIC;
  }
}
