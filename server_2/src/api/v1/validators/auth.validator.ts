// Zod schemas for all auth DTOs
import { z } from 'zod';
import { USER_ROLE } from '../../../domain/identity/enums/user-role.enum';

const emailSchema = z.string().email();

const phoneSchema_ = z.string().regex(/^\+[1-9]\d{7,14}$/, 'Phone number must be in valid E.164 format');

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one digit')
  .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character');

const addressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  pinCode: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  label: z.string().optional(),
});

const registerCustomerSchema = z.object({
  name: z.string().min(1),
  email: emailSchema,
  phone: phoneSchema_,
  password: passwordSchema,
  referralCode: z.string().optional(),
  address: addressSchema.optional(),
});

const registerDriverSchema = z.object({
  name: z.string().min(1),
  email: emailSchema,
  phone: phoneSchema_,
  password: passwordSchema,
  vehicle: z.object({
    type: z.string().min(1),
    brand: z.string().min(1),
    model: z.string().min(1),
    licensePlate: z.string().min(1),
    rcDocumentUrl: z.string().url(),
    insuranceUrl: z.string().url(),
  }),
});

export const registerSchema = z.discriminatedUnion('role', [
  z.object({ role: z.literal(USER_ROLE.CUSTOMER), customer: registerCustomerSchema }),
  z.object({ role: z.literal(USER_ROLE.DRIVER), driver: registerDriverSchema }),
]);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const otpCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Code must be a 6-digit number'),
});

export const phoneSchema = z.object({
  phone: phoneSchema_,
});

export const forgotSchema = z.object({
  email: emailSchema,
});

export const resetSchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/, 'Code must be a 6-digit number'),
  newPassword: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
