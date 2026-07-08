import { MoneyInput } from './shared';

export interface AddToCartDto {
  customerId: string;
  restaurantId: string;
  menuItemId: string;
  selectedOptionIds?: string[];
  quantity: number;
  unitPrice: MoneyInput;
}
