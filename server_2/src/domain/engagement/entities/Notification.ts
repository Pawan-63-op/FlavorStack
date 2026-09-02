import { AggregateRoot } from '../../shared/AggregateRoot';
import { Result } from '../../shared/Result';
import { Guard } from '../../shared/Guard';
import { UniqueEntityId } from '../../shared/UniqueEntityId';
import { NotificationStatus } from '../value-objects/NotificationStatus';
import { NotificationCategoryValue } from '../enums/notification-category.enum';
import { NotificationChannelValue } from '../enums/notification-channel.enum';
import { NOTIFICATION_STATUS } from '../enums/notification-status.enum';

export interface NotificationProps {
  recipientUserId: string;
  category: NotificationCategoryValue;
  channel: NotificationChannelValue;
  templateKey: string;
  renderedTitle: string;
  renderedBody: string;
  status: NotificationStatus;
  dedupeKey: string;
  provider?: string;
  createdAt: Date;
  sentAt?: Date;
  failedReason?: string;
  readAt?: Date;
}

export interface QueueNotificationInput {
  recipientUserId: string;
  category: NotificationCategoryValue;
  channel: NotificationChannelValue;
  templateKey: string;
  renderedTitle: string;
  renderedBody: string;
  dedupeKey: string;
  id?: UniqueEntityId;
}

export class Notification extends AggregateRoot<NotificationProps> {
  private constructor(props: NotificationProps, id?: UniqueEntityId) {
    super(props, id);
  }

  get recipientUserId(): string {
    return this.props.recipientUserId;
  }
  get category(): NotificationCategoryValue {
    return this.props.category;
  }
  get channel(): NotificationChannelValue {
    return this.props.channel;
  }
  get templateKey(): string {
    return this.props.templateKey;
  }
  get renderedTitle(): string {
    return this.props.renderedTitle;
  }
  get renderedBody(): string {
    return this.props.renderedBody;
  }
  get status(): NotificationStatus {
    return this.props.status;
  }
  get dedupeKey(): string {
    return this.props.dedupeKey;
  }
  get provider(): string | undefined {
    return this.props.provider;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get sentAt(): Date | undefined {
    return this.props.sentAt;
  }
  get failedReason(): string | undefined {
    return this.props.failedReason;
  }
  get readAt(): Date | undefined {
    return this.props.readAt;
  }

  private static guardInput(input: QueueNotificationInput): Result<void> {
    const recipientCheck = Guard.againstEmptyString(input.recipientUserId, 'RecipientUserId');
    if (recipientCheck.isFailure) return Result.fail<void>(recipientCheck.getError());

    const templateKeyCheck = Guard.againstEmptyString(input.templateKey, 'TemplateKey');
    if (templateKeyCheck.isFailure) return Result.fail<void>(templateKeyCheck.getError());

    const dedupeKeyCheck = Guard.againstEmptyString(input.dedupeKey, 'DedupeKey');
    if (dedupeKeyCheck.isFailure) return Result.fail<void>(dedupeKeyCheck.getError());

    return Result.ok<void>(undefined);
  }

  public static queue(input: QueueNotificationInput): Result<Notification> {
    const guarded = Notification.guardInput(input);
    if (guarded.isFailure) return Result.fail<Notification>(guarded.getError());

    return Result.ok<Notification>(
      new Notification(
        {
          recipientUserId: input.recipientUserId,
          category: input.category,
          channel: input.channel,
          templateKey: input.templateKey,
          renderedTitle: input.renderedTitle,
          renderedBody: input.renderedBody,
          status: NotificationStatus.pending(),
          dedupeKey: input.dedupeKey,
          createdAt: new Date(),
        },
        input.id
      )
    );
  }

  /**
   * Synchronous delivery (Phase 5 Batch 2). An INBOX notification *is* its Mongo row: there is no
   * transport, so there is no PENDING window and no failure mode. Born `SENT` with no `provider`;
   * `queue()` remains for channels that still hand off to a worker.
   */
  public static deliver(input: QueueNotificationInput): Result<Notification> {
    const guarded = Notification.guardInput(input);
    if (guarded.isFailure) return Result.fail<Notification>(guarded.getError());

    const now = new Date();

    return Result.ok<Notification>(
      new Notification(
        {
          recipientUserId: input.recipientUserId,
          category: input.category,
          channel: input.channel,
          templateKey: input.templateKey,
          renderedTitle: input.renderedTitle,
          renderedBody: input.renderedBody,
          status: NotificationStatus.sent(),
          dedupeKey: input.dedupeKey,
          createdAt: now,
          sentAt: now,
        },
        input.id
      )
    );
  }

  public markSent(provider: string): Result<void> {
    const transition = this.props.status.transitionTo(NOTIFICATION_STATUS.SENT);
    if (transition.isFailure) return Result.fail<void>(transition.getError());

    this.props.status = transition.getValue();
    this.props.provider = provider;
    this.props.sentAt = new Date();

    return Result.ok<void>(undefined);
  }

  public markFailed(reason: string): Result<void> {
    const transition = this.props.status.transitionTo(NOTIFICATION_STATUS.FAILED);
    if (transition.isFailure) return Result.fail<void>(transition.getError());

    this.props.status = transition.getValue();
    this.props.failedReason = reason;

    return Result.ok<void>(undefined);
  }

  public markRead(): Result<void> {
    const transition = this.props.status.transitionTo(NOTIFICATION_STATUS.READ);
    if (transition.isFailure) return Result.fail<void>(transition.getError());

    this.props.status = transition.getValue();
    this.props.readAt = new Date();

    return Result.ok<void>(undefined);
  }

  public static reconstitute(props: NotificationProps, id: UniqueEntityId): Notification {
    return new Notification({ ...props }, id);
  }
}
