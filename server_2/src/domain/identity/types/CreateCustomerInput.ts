
import { AuthProvider } from "../enums/auth-provider.enum"
import { Address } from "../value-objects/Address.vo"
export interface CreateCustomerInput {
  name:          string
  email:         string
  phone:         string

  passwordHash:  string        // plain password never enters domain
  authProvider?: AuthProvider
  providerId?:   string        // OAuth only

  referralCode?: string
  defaultAddress?: Address
}