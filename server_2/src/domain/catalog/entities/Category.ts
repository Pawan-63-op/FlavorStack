import { Entity } from '../../shared/Entity';
import { Result } from '../../shared/Result';
import { Guard } from '../../shared/Guard';
import { UniqueEntityId } from '../../shared/UniqueEntityId';
import { ValidationError } from '../../shared/errors/ValidationError';

interface CategoryProps {
  restaurantId: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

export class Category extends Entity<CategoryProps> {
  private constructor(props: CategoryProps, id?: UniqueEntityId) {
    super(props, id);
  }

  get restaurantId(): string {
    return this.props.restaurantId;
  }

  get label(): string {
    return this.props.label;
  }

  get sortOrder(): number {
    return this.props.sortOrder;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  public static create(
    props: { restaurantId: string; label: string; sortOrder: number; isActive?: boolean },
    id?: UniqueEntityId
  ): Result<Category> {
    const restaurantIdCheck = Guard.againstEmptyString(props.restaurantId, 'RestaurantId');
    if (restaurantIdCheck.isFailure) return Result.fail<Category>(restaurantIdCheck.getError());

    const labelCheck = Guard.againstEmptyString(props.label, 'Label');
    if (labelCheck.isFailure) return Result.fail<Category>(labelCheck.getError());

    if (typeof props.sortOrder !== 'number' || isNaN(props.sortOrder) || props.sortOrder < 0) {
      return Result.fail<Category>(new ValidationError('SortOrder must be a non-negative number'));
    }

    return Result.ok<Category>(
      new Category(
        {
          restaurantId: props.restaurantId,
          label: props.label.trim(),
          sortOrder: props.sortOrder,
          isActive: props.isActive ?? true,
        },
        id
      )
    );
  }

  public updateLabel(label: string): Result<void> {
    const labelCheck = Guard.againstEmptyString(label, 'Label');
    if (labelCheck.isFailure) return Result.fail<void>(labelCheck.getError());

    this.props.label = label.trim();
    return Result.ok<void>();
  }

  public updateSortOrder(sortOrder: number): Result<void> {
    if (typeof sortOrder !== 'number' || isNaN(sortOrder) || sortOrder < 0) {
      return Result.fail<void>(new ValidationError('SortOrder must be a non-negative number'));
    }

    this.props.sortOrder = sortOrder;
    return Result.ok<void>();
  }

  public activate(): void {
    this.props.isActive = true;
  }

  public deactivate(): void {
    this.props.isActive = false;
  }
}
