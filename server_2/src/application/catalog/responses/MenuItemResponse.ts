import { MoneyResponse } from './RestaurantResponse';

export interface ItemOptionResponse {
  id: string;
  label: string;
  priceDelta: MoneyResponse;
  isDefault: boolean;
  isAvailable: boolean;
}

export interface ItemVariantGroupResponse {
  id: string;
  label: string;
  selectionType: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: ItemOptionResponse[];
}

export interface MenuItemResponse {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  basePrice: MoneyResponse;
  tags: string[];
  dietary: string[];
  availability: {
    isAvailable: boolean;
    availableFrom?: Date;
    availableUntil?: Date;
    outOfStockReason?: string;
  };
  variantGroups: ItemVariantGroupResponse[];
  version: number;
}
