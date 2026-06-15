import { MoneyInput } from './shared';

// Input DTO: AddToCart — LineItemSelection { menuItemId, selectedOptionIds: string[], quantity }
// plus the owning restaurantId and the item's unit price.
//
// Phase 4 has no Catalog projection/ACL yet (Phases 5/10), so `restaurantId` and
// `unitPrice` are supplied by the caller for now. Once the local catalog projection
// (Phase 5) and the checkout-time ACL (Phase 10) exist, these will be re-derived
// from authoritative Catalog data instead of trusted client input.
export interface AddToCartDto {
  customerId: string;
  restaurantId: string;
  menuItemId: string;
  selectedOptionIds?: string[];
  quantity: number;
  unitPrice: MoneyInput;
}
