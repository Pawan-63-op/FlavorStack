// Batch 4A — resolver port (engagement_module.md §8). A Notification stores only `recipientUserId`;
// the channels need the concrete delivery address (email / device tokens). This port lets the channels
// resolve that address WITHOUT reaching into Identity's repositories. The composition root binds a
// concrete implementation that bridges to Identity-owned data (e.g. via IUserRepository.findById);
// Engagement infrastructure depends only on this interface, keeping the bounded-context boundary clean
// and the system cheap to split into services later.
export interface INotificationRecipientResolver {
  /** The recipient's email address, or null when none is on file (→ deterministic no_recipient failure). */
  resolveEmail(userId: string): Promise<string | null>;
  /** The recipient's registered push/device tokens. Empty array when none (→ no_recipient failure). */
  resolvePushTokens(userId: string): Promise<string[]>;
}
