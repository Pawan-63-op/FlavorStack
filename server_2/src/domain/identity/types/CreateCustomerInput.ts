// import { AuthProvider } from '../enums/AuthProvider'
// import { Address }      from '../value-objects/Address'

import { AuthProvider } from "../enums/auth-provider.enum"
import { Address } from "../value-objects/Address.vo"
export interface CreateCustomerInput {
  // identity
  name:          string
  email:         string
  phone:         string

  // auth
  passwordHash:  string        // plain password never enters domain
  authProvider?: AuthProvider
  providerId?:   string        // OAuth only

  // optional on registration
  referralCode?: string
  defaultAddress?: Address
}