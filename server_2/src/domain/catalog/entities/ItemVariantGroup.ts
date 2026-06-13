import { Entity } from '../../shared/Entity';
import { Result } from '../../shared/Result';
import { Guard } from '../../shared/Guard';
import { UniqueEntityId } from '../../shared/UniqueEntityId';
import { ValidationError } from '../../shared/errors/ValidationError';
import { NotFoundError } from '../../shared/errors/NotFoundError';
import { Money } from '../../shared/Money';

import { ItemOption } from './ItemOption';
import { VARIANT_SELECTION_TYPE, VariantSelectionType } from '../enums/variant-selection-type.enum';

interface ItemVariantGroupProps {
  label: string;
  selectionType: VariantSelectionType;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: ItemOption[];
}

function isNonNegativeInteger(value: number): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export class ItemVariantGroup extends Entity<ItemVariantGroupProps> {
  private constructor(props: ItemVariantGroupProps, id?: UniqueEntityId) {
    super(props, id);
  }

  get label(): string {
    return this.props.label;
  }

  get selectionType(): VariantSelectionType {
    return this.props.selectionType;
  }

  get required(): boolean {
    return this.props.required;
  }

  get minSelect(): number {
    return this.props.minSelect;
  }

  get maxSelect(): number {
    return this.props.maxSelect;
  }

  get options(): ItemOption[] {
    return [...this.props.options];
  }

  public static create(
    props: {
      label: string;
      selectionType: VariantSelectionType;
      required?: boolean;
      minSelect: number;
      maxSelect: number;
      options?: ItemOption[];
    },
    id?: UniqueEntityId
  ): Result<ItemVariantGroup> {
    const labelCheck = Guard.againstEmptyString(props.label, 'Label');
    if (labelCheck.isFailure) return Result.fail<ItemVariantGroup>(labelCheck.getError());

    if (!Object.values(VARIANT_SELECTION_TYPE).includes(props.selectionType)) {
      return Result.fail<ItemVariantGroup>(new ValidationError(`Invalid selection type: ${props.selectionType}`));
    }

    if (!isNonNegativeInteger(props.minSelect)) {
      return Result.fail<ItemVariantGroup>(new ValidationError('MinSelect must be a non-negative integer'));
    }

    if (!isNonNegativeInteger(props.maxSelect)) {
      return Result.fail<ItemVariantGroup>(new ValidationError('MaxSelect must be a non-negative integer'));
    }

    if (props.minSelect > props.maxSelect) {
      return Result.fail<ItemVariantGroup>(new ValidationError('MinSelect cannot be greater than MaxSelect'));
    }

    const required = props.required ?? false;
    if (required && props.minSelect < 1) {
      return Result.fail<ItemVariantGroup>(new ValidationError('A required group must have MinSelect >= 1'));
    }

    if (props.selectionType === VARIANT_SELECTION_TYPE.SINGLE && props.maxSelect !== 1) {
      return Result.fail<ItemVariantGroup>(new ValidationError('A SINGLE selection group must have MaxSelect = 1'));
    }

    const options = props.options ?? [];
    for (const option of options) {
      if (!(option instanceof ItemOption)) {
        return Result.fail<ItemVariantGroup>(new ValidationError('Options must be ItemOption instances'));
      }
    }

    return Result.ok<ItemVariantGroup>(
      new ItemVariantGroup(
        {
          label: props.label.trim(),
          selectionType: props.selectionType,
          required,
          minSelect: props.minSelect,
          maxSelect: props.maxSelect,
          options,
        },
        id
      )
    );
  }

  public addOption(props: { label: string; priceDelta: Money; isDefault?: boolean; isAvailable?: boolean }): Result<ItemOption> {
    const optionResult = ItemOption.create(props);
    if (optionResult.isFailure) return Result.fail<ItemOption>(optionResult.getError());

    const option = optionResult.getValue();
    this.props.options.push(option);
    return Result.ok<ItemOption>(option);
  }

  private findOption(optionId: string): ItemOption | undefined {
    return this.props.options.find((o) => o.id.toString() === optionId);
  }

  public updateOption(
    optionId: string,
    changes: { label?: string; priceDelta?: Money; isDefault?: boolean; isAvailable?: boolean }
  ): Result<void> {
    const option = this.findOption(optionId);
    if (!option) {
      return Result.fail<void>(new NotFoundError(`Option not found: ${optionId}`));
    }

    if (changes.label !== undefined) {
      const labelResult = option.updateLabel(changes.label);
      if (labelResult.isFailure) return Result.fail<void>(labelResult.getError());
    }

    if (changes.priceDelta !== undefined) {
      const priceResult = option.updatePriceDelta(changes.priceDelta);
      if (priceResult.isFailure) return Result.fail<void>(priceResult.getError());
    }

    if (changes.isDefault !== undefined) {
      option.setDefault(changes.isDefault);
    }

    if (changes.isAvailable !== undefined) {
      option.setAvailable(changes.isAvailable);
    }

    return Result.ok<void>();
  }

  public removeOption(optionId: string): Result<void> {
    const option = this.findOption(optionId);
    if (!option) {
      return Result.fail<void>(new NotFoundError(`Option not found: ${optionId}`));
    }

    this.props.options = this.props.options.filter((o) => o.id.toString() !== optionId);
    return Result.ok<void>();
  }

  public validateSelectionCount(count: number): Result<void> {
    if (count < this.props.minSelect || count > this.props.maxSelect) {
      return Result.fail<void>(
        new ValidationError(
          `"${this.props.label}" requires between ${this.props.minSelect} and ${this.props.maxSelect} selection(s)`
        )
      );
    }
    return Result.ok<void>();
  }

  public hasAvailableOption(): boolean {
    return this.props.options.some((o) => o.isAvailable);
  }
}
