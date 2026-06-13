import { Entity } from '../../shared/Entity';
import { Result } from '../../shared/Result';
import { Guard } from '../../shared/Guard';
import { UniqueEntityId } from '../../shared/UniqueEntityId';
import { ValidationError } from '../../shared/errors/ValidationError';
import { Money } from '../../shared/Money';

interface ItemOptionProps {
  label: string;
  priceDelta: Money;
  isDefault: boolean;
  isAvailable: boolean;
}

export class ItemOption extends Entity<ItemOptionProps> {
  private constructor(props: ItemOptionProps, id?: UniqueEntityId) {
    super(props, id);
  }

  get label(): string {
    return this.props.label;
  }

  get priceDelta(): Money {
    return this.props.priceDelta;
  }

  get isDefault(): boolean {
    return this.props.isDefault;
  }

  get isAvailable(): boolean {
    return this.props.isAvailable;
  }

  public static create(
    props: { label: string; priceDelta: Money; isDefault?: boolean; isAvailable?: boolean },
    id?: UniqueEntityId
  ): Result<ItemOption> {
    const labelCheck = Guard.againstEmptyString(props.label, 'Label');
    if (labelCheck.isFailure) return Result.fail<ItemOption>(labelCheck.getError());

    if (!(props.priceDelta instanceof Money)) {
      return Result.fail<ItemOption>(new ValidationError('PriceDelta must be a valid Money value object'));
    }

    return Result.ok<ItemOption>(
      new ItemOption(
        {
          label: props.label.trim(),
          priceDelta: props.priceDelta,
          isDefault: props.isDefault ?? false,
          isAvailable: props.isAvailable ?? true,
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

  public updatePriceDelta(priceDelta: Money): Result<void> {
    if (!(priceDelta instanceof Money)) {
      return Result.fail<void>(new ValidationError('PriceDelta must be a valid Money value object'));
    }

    this.props.priceDelta = priceDelta;
    return Result.ok<void>();
  }

  public setDefault(isDefault: boolean): void {
    this.props.isDefault = isDefault;
  }

  public setAvailable(isAvailable: boolean): void {
    this.props.isAvailable = isAvailable;
  }
}
