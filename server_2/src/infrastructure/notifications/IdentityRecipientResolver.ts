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
    return user instanceof Customer ? [...user.fcmTokens] : [];
  }
}
