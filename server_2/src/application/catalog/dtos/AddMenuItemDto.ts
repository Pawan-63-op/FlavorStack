import { DietaryTag } from '../../../domain/catalog/enums/dietary-tag.enum';
import { ActorContext, MoneyInput } from './shared';

export interface AddMenuItemDto extends ActorContext {
  restaurantId: string;
  categoryId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  basePrice: MoneyInput;
  tags?: string[];
  dietary?: DietaryTag[];
}
