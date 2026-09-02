import { ComposedEmail, IEmailComposer } from '../../domain/identity/services/IEmailComposer';
import { INotificationTemplateRepository } from '../../domain/engagement/repositories/INotificationTemplateRepository';
import { NOTIFICATION_CHANNEL } from '../../domain/engagement/enums/notification-channel.enum';

const DEFAULT_LOCALE = 'en';

/**
 * `IEmailComposer` over the Engagement template store. Read-only ACL: Identity gets rendered
 * copy, never the `NotificationTemplate` aggregate or its model.
 */
export class TemplateEmailComposer implements IEmailComposer {
  constructor(
    private readonly templateRepo: INotificationTemplateRepository,
    private readonly locale: string = DEFAULT_LOCALE
  ) {}

  async compose(templateKey: string, vars: Record<string, string>): Promise<ComposedEmail | null> {
    const template = await this.templateRepo.findByKeyChannelLocale(
      templateKey,
      NOTIFICATION_CHANNEL.EMAIL,
      this.locale
    );
    if (!template || !template.active) return null;

    const { title, body } = template.render(vars);
    return { subject: title, body };
  }
}
