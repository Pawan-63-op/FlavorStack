export interface VerifyEmailDto {
  code: string;
  /**
   * Authenticated flow (preferred): the session user id. The email-OTP route is
   * authed, so the controller supplies this from `req.user`.
   */
  userId?: string;
  /** Email-in-body flow (e.g. an unauthenticated verify link). */
  email?: string;
}
