export const OTP_TTL_SECONDS = {
  EMAIL_VERIFICATION: 15 * 60,
  PASSWORD_RESET: 15 * 60,
  PHONE_VERIFICATION: 10 * 60,
} as const;

export function emailVerificationOtpKey(userId: string): string {
  return `email-verify:${userId}`;
}

export function passwordResetOtpKey(userId: string): string {
  return `password-reset:${userId}`;
}

export function phoneVerificationOtpKey(userId: string): string {
  return `phone-verify:${userId}`;
}
