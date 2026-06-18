// UC: DispatchNotification (internal) — the shared notification dispatch flow used by every
// engagement event handler (engagement_module.md §4). Channel selection/sending happens later in the
// worker (Phase 4); this use case only resolves intent and queues durable work.
//
// Flow: dedupe guard → resolve preference (default-allow) → skip if channel disabled → load + render
// template (skip gracefully if missing/inactive) → Notification.queue(PENDING) → runInTransaction(save
// + outbox) → publishAll → enqueue to QUEUE.notification.
//
// Idempotency: the dedupe key (`sourceEventId:category`) is checked up front and is also a unique DB
// index, so at-least-once event redelivery collapses to a single notification + single enqueue.
import { Result } from '../../../domain/shared/Result';
import { Notification } from '../../../domain/engagement/entities/Notification';
import { NotificationPreference } from '../../../domain/engagement/entities/NotificationPreference';
import { INotificationRepository } from '../../../domain/engagement/repositories/INotificationRepository';
import { INotificationPreferenceRepository } from '../../../domain/engagement/repositories/INotificationPreferenceRepository';
import { INotificationTemplateRepository } from '../../../domain/engagement/repositories/INotificationTemplateRepository';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IOutboxStore } from '../../shared/outbox/IOutboxStore';
import { IEventBus } from '../../shared/events/IEventBus';
import { INotificationQueue } from '../../shared/queues/INotificationQueue';
import { DispatchNotificationDto, DispatchNotificationResponse } from '../dtos/DispatchNotificationDto';
import { buildDedupeKey, dedupeKeyToJobId } from './DedupeKeyBuilder';

const DEFAULT_LOCALE = 'en';

export class DispatchNotification {
  constructor(
    private readonly notificationRepo: INotificationRepository,
    private readonly preferenceRepo: INotificationPreferenceRepository,
    private readonly templateRepo: INotificationTemplateRepository,
    private readonly unitOfWork: IUnitOfWork,
    private readonly outboxStore: IOutboxStore,
    private readonly eventBus: IEventBus,
    private readonly notificationQueue: INotificationQueue
  ) {}

  async execute(dto: DispatchNotificationDto): Promise<Result<DispatchNotificationResponse>> {
    const dedupeKey = buildDedupeKey(dto.sourceEventId, dto.category);

    // Idempotency guard: same triggering event + category already produced a notification.
    const duplicate = await this.notificationRepo.findByDedupeKey(dedupeKey);
    if (duplicate) {
      return Result.ok({ outcome: 'SKIPPED', dedupeKey, reason: 'duplicate' });
    }

    // Preference resolution — default-allow when the user has no stored preference.
    const preference =
      (await this.preferenceRepo.findByUserId(dto.recipientUserId)) ??
      NotificationPreference.createDefault(dto.recipientUserId);
    if (!preference.isEnabled(dto.category, dto.channel)) {
      return Result.ok({ outcome: 'SKIPPED', dedupeKey, reason: 'channel_disabled' });
    }

    // Template resolution + rendering — skip gracefully if missing or deactivated.
    const locale = dto.locale ?? DEFAULT_LOCALE;
    const tmpl = await this.templateRepo.findByKeyChannelLocale(dto.templateKey, dto.channel, locale);
    if (!tmpl || !tmpl.active) {
      return Result.ok({ outcome: 'SKIPPED', dedupeKey, reason: 'template_unavailable' });
    }
    const { title, body } = tmpl.render(dto.vars ?? {});

    const notificationResult = Notification.queue({
      recipientUserId: dto.recipientUserId,
      category: dto.category,
      channel: dto.channel,
      templateKey: dto.templateKey,
      renderedTitle: title,
      renderedBody: body,
      dedupeKey,
    });
    if (notificationResult.isFailure) return Result.fail(notificationResult.getError());

    const notification = notificationResult.getValue();
    const events = notification.pullDomainEvents();

    await this.unitOfWork.runInTransaction(async (ctx) => {
      await this.notificationRepo.save(notification);
      if (events.length > 0) await this.outboxStore.append(events, ctx);
    });

    await this.eventBus.publishAll(events);

    // Enqueue after commit (mirrors publishAll-after-txn). dedupeKey-derived jobId gives queue-level
    // dedup so a retried handler invocation never double-enqueues.
    await this.notificationQueue.enqueue(
      { type: 'engagement', notificationId: notification.id.toString(), channel: dto.channel },
      { jobId: dedupeKeyToJobId(dedupeKey) }
    );

    return Result.ok({ outcome: 'DISPATCHED', dedupeKey, notificationId: notification.id.toString() });
  }
}
