// import { AuthProvider } from '../enums/AuthProvider'
// import { VehicleInfo }  from '../value-objects/VehicleInfo'

import { VehicleInfo } from "../value-objects/VehicleInfo.vo"

export interface CreateDriverInput {
  // identity
  name:         string
  email:        string
  phone:        string

  // auth
  passwordHash: string

  // driver-specific — required at registration
  vehicle:      VehicleInfo    // value object, not raw dto
}