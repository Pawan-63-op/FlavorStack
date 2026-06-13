import { Address } from "../../identity/value-objects/Address.vo"
import { GeoPoint } from "../../identity/value-objects/GeoPoint.vo"

export interface CreateRestaurantInput {
  ownerId:      string
  name:         string
  slug?:        string
  description?: string
  cuisineTypes: string[]
  address:      Address      // value object, reused from identity
  location:     GeoPoint      // value object, reused from identity
  phone:        string
  imageUrl?:    string
}
