import { MenuItem, MenuItemProps } from '../../../domain/catalog/entities/MenuItem';
import { ItemVariantGroup } from '../../../domain/catalog/entities/ItemVariantGroup';
import { ItemOption } from '../../../domain/catalog/entities/ItemOption';
import { ItemAvailability } from '../../../domain/catalog/value-objects/ItemAvailability.vo';
import { DietaryTag } from '../../../domain/catalog/enums/dietary-tag.enum';
import { Money } from '../../../domain/shared/Money';
import { UniqueEntityId } from '../../../domain/shared/UniqueEntityId';
import {
  MenuItemDocument,
  ItemVariantGroupDocument,
  ItemOptionDocument,
  ItemAvailabilityDocument,
} from '../models/MenuItemModel';
import { MoneyDocument } from '../models/RestaurantModel';
import { rebuildOrThrow } from './rebuildOrThrow';

function moneyToPersistence(money: Money): MoneyDocument {
  return { amount: money.amount, currency: money.currency };
}

function moneyToDomain(doc: MoneyDocument, context: string): Money {
  return rebuildOrThrow(Money.create(doc.amount, doc.currency), context);
}

function optionToPersistence(option: ItemOption): ItemOptionDocument {
  return {
    id: option.id.toString(),
    label: option.label,
    priceDelta: moneyToPersistence(option.priceDelta),
    isDefault: option.isDefault,
    isAvailable: option.isAvailable,
  };
}

function optionToDomain(doc: ItemOptionDocument): ItemOption {
  return rebuildOrThrow(
    ItemOption.create(
      {
        label: doc.label,
        priceDelta: moneyToDomain(doc.priceDelta, `ItemOption priceDelta (${doc.id})`),
        isDefault: doc.isDefault,
        isAvailable: doc.isAvailable,
      },
      new UniqueEntityId(doc.id)
    ),
    `ItemOption (${doc.id})`
  );
}

function variantGroupToPersistence(group: ItemVariantGroup): ItemVariantGroupDocument {
  return {
    id: group.id.toString(),
    label: group.label,
    selectionType: group.selectionType,
    required: group.required,
    minSelect: group.minSelect,
    maxSelect: group.maxSelect,
    options: group.options.map(optionToPersistence),
  };
}

function variantGroupToDomain(doc: ItemVariantGroupDocument): ItemVariantGroup {
  return rebuildOrThrow(
    ItemVariantGroup.create(
      {
        label: doc.label,
        selectionType: doc.selectionType,
        required: doc.required,
        minSelect: doc.minSelect,
        maxSelect: doc.maxSelect,
        options: doc.options.map(optionToDomain),
      },
      new UniqueEntityId(doc.id)
    ),
    `ItemVariantGroup (${doc.id})`
  );
}

function availabilityToPersistence(availability: ItemAvailability): ItemAvailabilityDocument {
  return {
    isAvailable: availability.isAvailable,
    availableFrom: availability.availableFrom ?? null,
    availableUntil: availability.availableUntil ?? null,
    outOfStockReason: availability.outOfStockReason ?? null,
  };
}

function availabilityToDomain(doc: ItemAvailabilityDocument): ItemAvailability {
  return rebuildOrThrow(
    ItemAvailability.create({
      isAvailable: doc.isAvailable,
      availableFrom: doc.availableFrom ?? undefined,
      availableUntil: doc.availableUntil ?? undefined,
      outOfStockReason: doc.outOfStockReason ?? undefined,
    }),
    'MenuItem availability'
  );
}

export class MenuItemMapper {
  static toPersistence(item: MenuItem): MenuItemDocument {
    return {
      _id: item.id.toString(),
      restaurantId: item.restaurantId,
      categoryId: item.categoryId,
      name: item.name,
      description: item.description ?? null,
      imageUrl: item.imageUrl ?? null,
      basePrice: moneyToPersistence(item.basePrice),
      tags: [...item.tags],
      dietary: [...item.dietary],
      availability: availabilityToPersistence(item.availability),
      variantGroups: item.variantGroups.map(variantGroupToPersistence),
      version: item.version,
      deletedAt: item.deletedAt,
    };
  }

  static toDomain(doc: MenuItemDocument): MenuItem {
    const props: MenuItemProps = {
      restaurantId: doc.restaurantId,
      categoryId: doc.categoryId,
      name: doc.name,
      description: doc.description ?? undefined,
      imageUrl: doc.imageUrl ?? undefined,
      basePrice: moneyToDomain(doc.basePrice, 'MenuItem basePrice'),
      tags: [...doc.tags],
      dietary: [...doc.dietary] as DietaryTag[],
      availability: availabilityToDomain(doc.availability),
      variantGroups: doc.variantGroups.map(variantGroupToDomain),
      version: doc.version,
      deletedAt: doc.deletedAt,
    };

    return MenuItem.reconstitute(props, new UniqueEntityId(doc._id));
  }
}
