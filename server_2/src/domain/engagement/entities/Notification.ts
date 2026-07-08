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

  public static queue(input: QueueNotificationInput): Result<Notification> {
    const recipientCheck = Guard.againstEmptyString(input.recipientUserId, 'RecipientUserId');
    if (recipientCheck.isFailure) return Result.fail<Notification>(recipientCheck.getError());

    const templateKeyCheck = Guard.againstEmptyString(input.templateKey, 'TemplateKey');
    if (templateKeyCheck.isFailure) return Result.fail<Notification>(templateKeyCheck.getError());

    const dedupeKeyCheck = Guard.againstEmptyString(input.dedupeKey, 'DedupeKey');
    if (dedupeKeyCheck.isFailure) return Result.fail<Notification>(dedupeKeyCheck.getError());

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
