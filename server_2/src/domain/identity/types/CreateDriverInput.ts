
import { VehicleInfo } from "../value-objects/VehicleInfo.vo"

export interface CreateDriverInput {
  name:         string
  email:        string
  phone:        string

  passwordHash: string

  vehicle:      VehicleInfo    // value object, not raw dto
}