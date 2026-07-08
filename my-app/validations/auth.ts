
import {z} from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email address"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z
  .object({
    name: z
      .string()
      .min(1, "Name is required")
      .min(2, "Name must be at least 2 characters")
      .max(50, "Name must be less than 50 characters"),
    email: z
      .string()
      .min(1, "Email is required")
      .email("Invalid email address"),
    password: z
      .string()
      .min(1, "Password is required")
      .min(6, "Password must be at least 6 characters")
      .max(100, "Password must be less than 100 characters"),
    confirmPassword: z
      .string()
      .min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export const verifyEmailSchema = z.object({
  otp: z
    .string()
    .length(6, "OTP must be 6 digits")
    .regex(/^\d+$/, "OTP must contain only numbers"),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email address"),
});

export const resetPasswordSchema = z
  .object({
    otp: z
      .string()
      .length(6, "OTP must be 6 digits")
      .regex(/^\d+$/, "OTP must contain only numbers"),
    newPassword: z
      .string()
      .min(1, "Password is required")
      .min(6, "Password must be at least 6 characters")
      .max(100, "Password must be less than 100 characters"),
    confirmPassword: z
      .string()
      .min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type VerifyEmailFormData = z.infer<typeof verifyEmailSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;


const e164PhoneRegex = /^\+[1-9]\d{7,14}$/;
const strongPasswordSchema = z
  .string()
  .min(1, "Password is required")
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one digit")
  .regex(/[!@#$%^&*(),.?":{}|<>]/, "Password must contain at least one special character");

export const phoneSchema = z.object({
  phone: z.string().regex(e164PhoneRegex, "Phone number must be in valid E.164 format"),
});

export const codeSchema = z.object({
  code: z
    .string()
    .length(6, "Code must be 6 digits")
    .regex(/^\d+$/, "Code must contain only numbers"),
});

export const registerWithPhoneSchema = z
  .object({
    name: z
      .string()
      .min(1, "Name is required")
      .min(2, "Name must be at least 2 characters")
      .max(50, "Name must be less than 50 characters"),
    email: z
      .string()
      .min(1, "Email is required")
      .email("Invalid email address"),
    phone: z.string().regex(e164PhoneRegex, "Phone number must be in valid E.164 format"),
    password: strongPasswordSchema,
    confirmPassword: z
      .string()
      .min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const resetPasswordWithCodeSchema = z
  .object({
    code: z
      .string()
      .length(6, "Code must be 6 digits")
      .regex(/^\d+$/, "Code must contain only numbers"),
    newPassword: strongPasswordSchema,
    confirmPassword: z
      .string()
      .min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });


export const onboardingRoleSchema = z.enum(["CUSTOMER", "DRIVER"]);

const httpUrlSchema = z
  .string()
  .min(1, "This document URL is required")
  .url("Must be a valid URL (https://…)");

export const registerWithRoleSchema = z
  .object({
    role: onboardingRoleSchema,
    name: z
      .string()
      .min(1, "Name is required")
      .min(2, "Name must be at least 2 characters")
      .max(50, "Name must be less than 50 characters"),
    email: z
      .string()
      .min(1, "Email is required")
      .email("Invalid email address"),
    phone: z.string().regex(e164PhoneRegex, "Phone number must be in valid E.164 format"),
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
    vehicle: z
      .object({
        type: z.string().optional(),
        brand: z.string().optional(),
        model: z.string().optional(),
        licensePlate: z.string().optional(),
        rcDocumentUrl: z.string().optional(),
        insuranceUrl: z.string().optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    }

    if (data.role !== "DRIVER") return;

    const v = data.vehicle ?? {};
    const textFields: Array<[keyof typeof v, string]> = [
      ["type", "Vehicle type is required"],
      ["brand", "Brand is required"],
      ["model", "Model is required"],
      ["licensePlate", "License plate is required"],
    ];
    for (const [field, message] of textFields) {
      if (!v[field]?.trim?.()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ["vehicle", field] });
      }
    }
    for (const field of ["rcDocumentUrl", "insuranceUrl"] as const) {
      const parsed = httpUrlSchema.safeParse(v[field]);
      if (!parsed.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: parsed.error.issues[0]?.message ?? "Must be a valid URL",
          path: ["vehicle", field],
        });
      }
    }
  });

export type PhoneFormData = z.infer<typeof phoneSchema>;
export type CodeFormData = z.infer<typeof codeSchema>;
export type RegisterWithPhoneFormData = z.infer<typeof registerWithPhoneSchema>;
export type ResetPasswordWithCodeFormData = z.infer<typeof resetPasswordWithCodeSchema>;
export type OnboardingRole = z.infer<typeof onboardingRoleSchema>;
export type RegisterWithRoleFormData = z.infer<typeof registerWithRoleSchema>;
