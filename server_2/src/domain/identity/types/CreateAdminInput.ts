// domain/types/CreateAdminInput.ts
// import { Permission } from "../identity/entities/Admin";
import { Permission }         from "../value-objects/Permission.vo";
export interface CreateAdminInput {
  name:        string
  email:       string
  phone:       string
  passwordHash: string      // already hashed — domain doesn't touch plain passwords
  department:  string
  permissions?: Permission[]
  isSuperAdmin?: boolean
}