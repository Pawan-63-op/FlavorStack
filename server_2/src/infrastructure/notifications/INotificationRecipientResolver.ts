export interface INotificationRecipientResolver {
  /** The recipient's email address, or null when none is on file (→ deterministic no_recipient failure). */
  resolveEmail(userId: string): Promise<string | null>;
  /** The recipient's registered push/device tokens. Empty array when none (→ no_recipient failure). */
  resolvePushTokens(userId: string): Promise<string[]>;
}
