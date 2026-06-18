// Batch 4B — composition-root bridge implementing the Engagement INotificationRecipientResolver port
// against Identity-owned data, accessed only through the IUserRepository *interface*. This keeps the
// notification channels free of any Identity dependency: they depend on the port, and this single
// adapter (wired in the container) is the one sanctioned place that reads a recipient's email/tokens
// from Identity. At a service split, this is the only class that becomes a network call.
import { INotificationRecipientResolver } from './INotificationRecipientResolver';
import { IUserRepository } from '../../domain/identity/repositories/IUserRepository';
import { Customer } from '../../domain/identity/entities/Customer';

export class IdentityRecipientResolver implements INotificationRecipientResolver {
  constructor(private readonly users: IUserRepository) {}

  async resolveEmail(userId: string): Promise<string | null> {
    const user = await this.users.findById(userId);
    return user ? user.email : null;
  }

  async resolvePushTokens(userId: string): Promise<string[]> {
    const user = await this.users.findById(userId);
    // Device tokens live on Customer (Identity's source of truth — engagement_module.md §2 boundary note).
    return user instanceof Customer ? [...user.fcmTokens] : [];
  }
}
