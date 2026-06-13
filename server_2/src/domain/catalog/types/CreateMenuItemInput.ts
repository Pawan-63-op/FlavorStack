import { Money } from "../../shared/Money"
import { DietaryTag } from "../enums/dietary-tag.enum"

export interface CreateMenuItemInput {
  restaurantId: string
  categoryId:   string
  name:         string
  description?: string
  imageUrl?:    string
  basePrice:    Money        // value object, shared kernel (paise)
  tags?:        string[]
  dietary?:     DietaryTag[]
}
