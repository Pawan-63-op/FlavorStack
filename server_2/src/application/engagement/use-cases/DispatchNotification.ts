import { Result } from '../../../domain/shared/Result';
import { Notification } from '../../../domain/engagement/entities/Notification';
import { NotificationPreference } from '../../../domain/engagement/entities/NotificationPreference';
import { INotificationRepository } from '../../../domain/engagement/repositories/INotificationRepository';
import { INotificationPreferenceRepository } from '../../../domain/engagement/repositories/INotificationPreferenceRepository';
import { INotificationTemplateRepository } from '../../../domain/engagement/repositories/INotificationTemplateRepository';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { DispatchNotificationDto, DispatchNotificationResponse } from '../dtos/DispatchNotificationDto';
import { buildDedupeKey } from './DedupeKeyBuilder';

const DEFAULT_LOCALE = 'en';

export class DispatchNotification {
  constructor(
    private readonly notificationRepo: INotificationRepository,
    private readonly preferenceRepo: INotificationPreferenceRepository,
    private readonly templateRepo: INotificationTemplateRepository,
    private readonly unitOfWork: IUnitOfWork
  ) {}

  async execute(dto: DispatchNotificationDto): Promise<Result<DispatchNotificationResponse>> {
    const dedupeKey = buildDedupeKey(dto.sourceEventId, dto.category);

    const duplicate = await this.notificationRepo.findByDedupeKey(dedupeKey);
    if (duplicate) {
      return Result.ok({ outcome: 'SKIPPED', dedupeKey, reason: 'duplicate' });
    }

    const preference =
      (await this.preferenceRepo.findByUserId(dto.recipientUserId)) ??
      NotificationPreference.createDefault(dto.recipientUserId);
    if (!preference.isEnabled(dto.category, dto.channel)) {
      return Result.ok({ outcome: 'SKIPPED', dedupeKey, reason: 'channel_disabled' });
    }

    const locale = dto.locale ?? DEFAULT_LOCALE;
    const tmpl = await this.templateRepo.findByKeyChannelLocale(dto.templateKey, dto.channel, locale);
    if (!tmpl || !tmpl.active) {
      return Result.ok({ outcome: 'SKIPPED', dedupeKey, reason: 'template_unavailable' });
    }
    const { title, body } = tmpl.render(dto.vars ?? {});

    const input = {
      recipientUserId: dto.recipientUserId,
      category: dto.category,
      channel: dto.channel,
      templateKey: dto.templateKey,
      renderedTitle: title,
      renderedBody: body,
      dedupeKey,
    };

    // The Mongo row *is* the delivery: the notification is born SENT, inside the transaction below.
    // There is no queue, no provider, and no failure mode (Phase 5 Batch 4 deleted the tier).
    const notificationResult = Notification.deliver(input);
    if (notificationResult.isFailure) return Result.fail(notificationResult.getError());

    const notification = notificationResult.getValue();

    // `Notification` raises no domain events — nothing downstream reacts to a delivered
    // notification — so there is no outbox append and nothing to publish. The transaction
    // is kept because the dedupe-key unique index is what makes a concurrent double-dispatch
    // fail loudly rather than insert twice.
    await this.unitOfWork.runInTransaction(async () => {
      await this.notificationRepo.save(notification);
    });

    return Result.ok({ outcome: 'DISPATCHED', dedupeKey, notificationId: notification.id.toString() });
  }
}
