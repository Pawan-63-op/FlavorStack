import { DietaryTag } from '../../../domain/catalog/enums/dietary-tag.enum';
import { ActorContext, MoneyInput } from './shared';

export interface UpdateMenuItemDto extends ActorContext {
  itemId: string;
  categoryId?: string;
  name?: string;
  description?: string;
  imageUrl?: string;
  price?: MoneyInput;
  tags?: string[];
  dietary?: DietaryTag[];
}
