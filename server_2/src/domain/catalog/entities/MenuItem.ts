import { AggregateRoot } from '../../shared/AggregateRoot';
import { Result } from '../../shared/Result';
import { Guard } from '../../shared/Guard';
import { UniqueEntityId } from '../../shared/UniqueEntityId';
import { ValidationError } from '../../shared/errors/ValidationError';
import { ConflictError } from '../../shared/errors/ConflictError';
import { Money } from '../../shared/Money';

import { ItemAvailability } from '../value-objects/ItemAvailability.vo';
import { ItemVariantGroup } from './ItemVariantGroup';
import { DIETARY_TAG, DietaryTag } from '../enums/dietary-tag.enum';
import { CreateMenuItemInput } from '../types/CreateMenuItemInput';

import { MenuItemCreated } from '../events/MenuItemCreated';
import { MenuItemUpdated } from '../events/MenuItemUpdated';
import { MenuItemAvailabilityChanged } from '../events/MenuItemAvailabilityChanged';

export interface MenuItemProps {
  restaurantId: string;
  categoryId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  basePrice: Money;
  tags: string[];
  dietary: DietaryTag[];
  availability: ItemAvailability;
  variantGroups: ItemVariantGroup[];
  version: number;
  deletedAt: Date | null;
}

function validateDietary(values: string[]): Result<DietaryTag[]> {
  const allowed = Object.values(DIETARY_TAG);
  const dietary: DietaryTag[] = [];
  for (const value of values) {
    if (!allowed.includes(value as DietaryTag)) {
      return Result.fail<DietaryTag[]>(new ValidationError(`Invalid dietary tag: ${value}`));
    }
    dietary.push(value as DietaryTag);
  }
  return Result.ok<DietaryTag[]>(dietary);
}

export class MenuItem extends AggregateRoot<MenuItemProps> {
  private readonly _persistedVersion: number;

  private constructor(props: MenuItemProps, id?: UniqueEntityId) {
    super(props, id);
    this._persistedVersion = props.version;
  }

  get persistedVersion(): number {
    return this._persistedVersion;
  }

  get restaurantId(): string {
    return this.props.restaurantId;
  }

  get categoryId(): string {
    return this.props.categoryId;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  get imageUrl(): string | undefined {
    return this.props.imageUrl;
  }

  get basePrice(): Money {
    return this.props.basePrice;
  }

  get tags(): string[] {
    return [...this.props.tags];
  }

  get dietary(): DietaryTag[] {
    return [...this.props.dietary];
  }

  get availability(): ItemAvailability {
    return this.props.availability;
  }

  get variantGroups(): ItemVariantGroup[] {
    return [...this.props.variantGroups];
  }

  get version(): number {
    return this.props.version;
  }

  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }

  private touch(): void {
    this.props.version += 1;
  }

  public static create(input: CreateMenuItemInput, id?: UniqueEntityId): Result<MenuItem> {
    const restaurantIdCheck = Guard.againstEmptyString(input.restaurantId, 'RestaurantId');
    if (restaurantIdCheck.isFailure) return Result.fail<MenuItem>(restaurantIdCheck.getError());

    const categoryIdCheck = Guard.againstEmptyString(input.categoryId, 'CategoryId');
    if (categoryIdCheck.isFailure) return Result.fail<MenuItem>(categoryIdCheck.getError());

    const nameCheck = Guard.againstEmptyString(input.name, 'Name');
    if (nameCheck.isFailure) return Result.fail<MenuItem>(nameCheck.getError());

    if (!(input.basePrice instanceof Money)) {
      return Result.fail<MenuItem>(new ValidationError('BasePrice must be a valid Money value object'));
    }

    let tags: string[] = [];
    if (input.tags !== undefined) {
      if (!Array.isArray(input.tags)) {
        return Result.fail<MenuItem>(new ValidationError('Tags must be an array'));
      }
      tags = input.tags;
    }

    let dietary: DietaryTag[] = [];
    if (input.dietary !== undefined) {
      if (!Array.isArray(input.dietary)) {
        return Result.fail<MenuItem>(new ValidationError('Dietary must be an array'));
      }
      const dietaryResult = validateDietary(input.dietary as string[]);
      if (dietaryResult.isFailure) return Result.fail<MenuItem>(dietaryResult.getError());
      dietary = dietaryResult.getValue();
    }

    const availabilityResult = ItemAvailability.create({ isAvailable: true });
    if (availabilityResult.isFailure) return Result.fail<MenuItem>(availabilityResult.getError());

    const menuItem = new MenuItem(
      {
        restaurantId: input.restaurantId,
        categoryId: input.categoryId,
        name: input.name.trim(),
        description: input.description,
        imageUrl: input.imageUrl,
        basePrice: input.basePrice,
        tags,
        dietary,
        availability: availabilityResult.getValue(),
        variantGroups: [],
        version: 0,
        deletedAt: null,
      },
      id
    );

    menuItem.addDomainEvent(
      new MenuItemCreated(menuItem.id.toString(), menuItem.restaurantId, menuItem.categoryId, menuItem.name)
    );

    return Result.ok<MenuItem>(menuItem);
  }

  /**
   * Rebuild a MenuItem from already-valid persisted state. Unlike `create()`, this
   * raises no domain events and forces no initial availability/version — it is the
   * repository's rehydration entry point. Callers (mappers) own reconstructing the
   * value objects and variant groups from the stored document.
   */
  public static reconstitute(props: MenuItemProps, id: UniqueEntityId): MenuItem {
    return new MenuItem(props, id);
  }

  public updateDetails(changes: {
    name?: string;
    description?: string;
    imageUrl?: string;
    tags?: string[];
    dietary?: string[];
  }): Result<void> {
    const changedFields: string[] = [];

    let nextName = this.props.name;
    if (changes.name !== undefined) {
      const nameCheck = Guard.againstEmptyString(changes.name, 'Name');
      if (nameCheck.isFailure) return Result.fail<void>(nameCheck.getError());
      nextName = changes.name.trim();
    }

    let nextTags = this.props.tags;
    if (changes.tags !== undefined) {
      if (!Array.isArray(changes.tags)) {
        return Result.fail<void>(new ValidationError('Tags must be an array'));
      }
      nextTags = changes.tags;
    }

    let nextDietary = this.props.dietary;
    if (changes.dietary !== undefined) {
      if (!Array.isArray(changes.dietary)) {
        return Result.fail<void>(new ValidationError('Dietary must be an array'));
      }
      const dietaryResult = validateDietary(changes.dietary);
      if (dietaryResult.isFailure) return Result.fail<void>(dietaryResult.getError());
      nextDietary = dietaryResult.getValue();
    }

    if (changes.name !== undefined) {
      this.props.name = nextName;
      changedFields.push('name');
    }
    if (changes.description !== undefined) {
      this.props.description = changes.description;
      changedFields.push('description');
    }
    if (changes.imageUrl !== undefined) {
      this.props.imageUrl = changes.imageUrl;
      changedFields.push('imageUrl');
    }
    if (changes.tags !== undefined) {
      this.props.tags = nextTags;
      changedFields.push('tags');
    }
    if (changes.dietary !== undefined) {
      this.props.dietary = nextDietary;
      changedFields.push('dietary');
    }

    if (changedFields.length === 0) {
      return Result.ok<void>();
    }

    this.touch();
    this.addDomainEvent(new MenuItemUpdated(this.id.toString(), changedFields));
    return Result.ok<void>();
  }

  public changePrice(newPrice: Money): Result<void> {
    if (!(newPrice instanceof Money)) {
      return Result.fail<void>(new ValidationError('Price must be a valid Money value object'));
    }

    if (newPrice.equals(this.props.basePrice)) {
      return Result.ok<void>();
    }

    this.props.basePrice = newPrice;
    this.touch();
    this.addDomainEvent(new MenuItemUpdated(this.id.toString(), ['basePrice']));
    return Result.ok<void>();
  }

  public assignCategory(categoryId: string): Result<void> {
    const categoryIdCheck = Guard.againstEmptyString(categoryId, 'CategoryId');
    if (categoryIdCheck.isFailure) return Result.fail<void>(categoryIdCheck.getError());

    if (categoryId === this.props.categoryId) {
      return Result.ok<void>();
    }

    this.props.categoryId = categoryId;
    this.touch();
    this.addDomainEvent(new MenuItemUpdated(this.id.toString(), ['categoryId']));
    return Result.ok<void>();
  }

  public toggleAvailability(availability: ItemAvailability): Result<void> {
    if (!(availability instanceof ItemAvailability)) {
      return Result.fail<void>(new ValidationError('Availability must be a valid ItemAvailability value object'));
    }

    this.props.availability = availability;
    this.touch();
    this.addDomainEvent(
      new MenuItemAvailabilityChanged(
        this.id.toString(),
        this.props.restaurantId,
        availability.isAvailable,
        availability.outOfStockReason
      )
    );
    return Result.ok<void>();
  }

  public setItemVariants(groups: ItemVariantGroup[]): Result<void> {
    if (!Array.isArray(groups) || groups.some((g) => !(g instanceof ItemVariantGroup))) {
      return Result.fail<void>(new ValidationError('VariantGroups must be an array of ItemVariantGroup'));
    }

    for (const group of groups) {
      if (group.required && !group.hasAvailableOption()) {
        return Result.fail<void>(
          new ValidationError(`Required variant group "${group.label}" must have at least one available option`)
        );
      }
    }

    this.props.variantGroups = groups;
    this.touch();
    this.addDomainEvent(new MenuItemUpdated(this.id.toString(), ['variantGroups']));
    return Result.ok<void>();
  }

  public priceFor(selectedOptionIds: string[]): Result<Money> {
    if (!Array.isArray(selectedOptionIds)) {
      return Result.fail<Money>(new ValidationError('SelectedOptionIds must be an array'));
    }

    let total = this.props.basePrice;
    const matchedIds = new Set<string>();

    for (const group of this.props.variantGroups) {
      const selected = group.options.filter((o) => selectedOptionIds.includes(o.id.toString()));

      const countResult = group.validateSelectionCount(selected.length);
      if (countResult.isFailure) return Result.fail<Money>(countResult.getError());

      for (const option of selected) {
        matchedIds.add(option.id.toString());

        if (!option.isAvailable) {
          return Result.fail<Money>(new ValidationError(`Selected option is not available: ${option.label}`));
        }

        const sumResult = total.add(option.priceDelta);
        if (sumResult.isFailure) return Result.fail<Money>(sumResult.getError());
        total = sumResult.getValue();
      }
    }

    for (const optionId of selectedOptionIds) {
      if (!matchedIds.has(optionId)) {
        return Result.fail<Money>(new ValidationError(`Unknown option id: ${optionId}`));
      }
    }

    return Result.ok<Money>(total);
  }

  public softDelete(): Result<void> {
    if (this.props.deletedAt !== null) {
      return Result.fail<void>(new ConflictError('MenuItem is already deleted'));
    }

    this.props.deletedAt = new Date();
    this.touch();
    return Result.ok<void>();
  }
}
