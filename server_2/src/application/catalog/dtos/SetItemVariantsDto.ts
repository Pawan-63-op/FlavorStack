import { VariantSelectionType } from '../../../domain/catalog/enums/variant-selection-type.enum';
import { ActorContext, MoneyInput } from './shared';

export interface ItemOptionInput {
  label: string;
  priceDelta: MoneyInput;
  isDefault?: boolean;
  isAvailable?: boolean;
}

export interface ItemVariantGroupInput {
  label: string;
  selectionType: VariantSelectionType;
  required?: boolean;
  minSelect: number;
  maxSelect: number;
  options?: ItemOptionInput[];
}

export interface SetItemVariantsDto extends ActorContext {
  itemId: string;
  groups: ItemVariantGroupInput[];
}
