import { Restaurant } from '../../../domain/catalog/entities/Restaurant';
import { Category } from '../../../domain/catalog/entities/Category';
import { DeliveryZone } from '../../../domain/catalog/entities/DeliveryZone';
import { MenuItem } from '../../../domain/catalog/entities/MenuItem';
import { ItemVariantGroup } from '../../../domain/catalog/entities/ItemVariantGroup';
import { ItemOption } from '../../../domain/catalog/entities/ItemOption';
import { Money } from '../../../domain/shared/Money';
import { CategoryResponse, DeliveryZoneResponse, MoneyResponse, RestaurantResponse } from './RestaurantResponse';
import { ItemOptionResponse, ItemVariantGroupResponse, MenuItemResponse } from './MenuItemResponse';

function toMoneyResponse(money: Money): MoneyResponse {
  return { amount: money.amount, currency: money.currency };
}

export function toCategoryResponse(category: Category): CategoryResponse {
  return {
    id: category.id.toString(),
    label: category.label,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
  };
}

export function toDeliveryZoneResponse(zone: DeliveryZone): DeliveryZoneResponse {
  return {
    id: zone.id.toString(),
    polygon: { points: zone.polygon.points.map((p) => ({ lat: p.lat, lng: p.lng })) },
    feeMatrix: {
      tiers: zone.feeMatrix.tiers.map((t) => ({
        maxDistanceMeters: t.maxDistanceMeters,
        fee: toMoneyResponse(t.fee),
      })),
      freeAboveSubtotal: zone.feeMatrix.freeAboveSubtotal
        ? toMoneyResponse(zone.feeMatrix.freeAboveSubtotal)
        : undefined,
    },
    minOrder: toMoneyResponse(zone.minOrder),
  };
}

export function toRestaurantResponse(restaurant: Restaurant): RestaurantResponse {
  return {
    id: restaurant.id.toString(),
    ownerId: restaurant.ownerId,
    name: restaurant.name,
    slug: restaurant.slug,
    description: restaurant.description,
    cuisineTypes: restaurant.cuisineTypes.map((c) => c.value),
    address: {
      label: restaurant.address.label,
      street: restaurant.address.street,
      city: restaurant.address.city,
      state: restaurant.address.state,
      pinCode: restaurant.address.pinCode,
      coordinates: { lat: restaurant.address.coordinates.lat, lng: restaurant.address.coordinates.lng },
    },
    location: { lat: restaurant.location.lat, lng: restaurant.location.lng },
    phone: restaurant.phone,
    imageUrl: restaurant.imageUrl,
    status: restaurant.status.value,
    visibility: restaurant.visibility.value,
    categories: restaurant.categories.map(toCategoryResponse),
    openingHours: restaurant.openingHours
      ? { schedule: restaurant.openingHours.schedule, holidays: restaurant.openingHours.holidays }
      : undefined,
    deliveryZones: restaurant.deliveryZones.map(toDeliveryZoneResponse),
    version: restaurant.version,
  };
}

export function toItemOptionResponse(option: ItemOption): ItemOptionResponse {
  return {
    id: option.id.toString(),
    label: option.label,
    priceDelta: toMoneyResponse(option.priceDelta),
    isDefault: option.isDefault,
    isAvailable: option.isAvailable,
  };
}

export function toItemVariantGroupResponse(group: ItemVariantGroup): ItemVariantGroupResponse {
  return {
    id: group.id.toString(),
    label: group.label,
    selectionType: group.selectionType,
    required: group.required,
    minSelect: group.minSelect,
    maxSelect: group.maxSelect,
    options: group.options.map(toItemOptionResponse),
  };
}

export function toMenuItemResponse(menuItem: MenuItem): MenuItemResponse {
  return {
    id: menuItem.id.toString(),
    restaurantId: menuItem.restaurantId,
    categoryId: menuItem.categoryId,
    name: menuItem.name,
    description: menuItem.description,
    imageUrl: menuItem.imageUrl,
    basePrice: toMoneyResponse(menuItem.basePrice),
    tags: menuItem.tags,
    dietary: menuItem.dietary,
    availability: {
      isAvailable: menuItem.availability.isAvailable,
      availableFrom: menuItem.availability.availableFrom,
      availableUntil: menuItem.availability.availableUntil,
      outOfStockReason: menuItem.availability.outOfStockReason,
    },
    variantGroups: menuItem.variantGroups.map(toItemVariantGroupResponse),
    version: menuItem.version,
  };
}
