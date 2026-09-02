import { AggregateRoot } from '../../shared/AggregateRoot';
import { Result } from '../../shared/Result';
import { Guard } from '../../shared/Guard';
import { UniqueEntityId } from '../../shared/UniqueEntityId';
import { ValidationError } from '../../shared/errors/ValidationError';
import { ChannelToggle } from '../value-objects/ChannelToggle';
import { NOTIFICATION_CATEGORY, NotificationCategoryValue } from '../enums/notification-category.enum';
import { NotificationChannelValue } from '../enums/notification-channel.enum';

export interface NotificationPreferenceProps {
  userId: string;
  channels: Record<NotificationCategoryValue, ChannelToggle>;
  updatedAt: Date;
}

export class NotificationPreference extends AggregateRoot<NotificationPreferenceProps> {
  private constructor(props: NotificationPreferenceProps, id?: UniqueEntityId) {
    super(props, id);
  }

  get userId(): string {
    return this.props.userId;
  }

  get channels(): Record<NotificationCategoryValue, ChannelToggle> {
    return { ...this.props.channels };
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** All categories enabled on both channels; PROMOTIONS is inbox-only. */
  public static createDefault(userId: string, id?: UniqueEntityId): NotificationPreference {
    return new NotificationPreference(
      {
        userId,
        channels: {
          [NOTIFICATION_CATEGORY.ORDER_UPDATES]: ChannelToggle.allEnabled(),
          [NOTIFICATION_CATEGORY.DELIVERY]: ChannelToggle.allEnabled(),
          [NOTIFICATION_CATEGORY.SECURITY]: ChannelToggle.allEnabled(),
          [NOTIFICATION_CATEGORY.PROMOTIONS]: ChannelToggle.inboxOnly(),
        },
        updatedAt: new Date(),
      },
      id
    );
  }

  public setChannel(
    category: NotificationCategoryValue,
    channel: NotificationChannelValue,
    enabled: boolean
  ): Result<void> {
    if (!Object.values(NOTIFICATION_CATEGORY).includes(category)) {
      return Result.fail<void>(new ValidationError(`Invalid notification category: ${category}`));
    }

    const guard = Guard.againstNullOrUndefined(channel, 'Channel');
    if (guard.isFailure) return Result.fail<void>(guard.getError());

    const current = this.props.channels[category] ?? ChannelToggle.allEnabled();
    this.props.channels[category] = current.withChannel(channel, enabled);
    this.props.updatedAt = new Date();

    return Result.ok<void>(undefined);
  }

  /** Default-allow: a category absent from the map is treated as enabled. */
  public isEnabled(category: NotificationCategoryValue, channel: NotificationChannelValue): boolean {
    const toggle = this.props.channels[category];
    return toggle ? toggle.isEnabled(channel) : true;
  }

  public static reconstitute(props: NotificationPreferenceProps, id: UniqueEntityId): NotificationPreference {
    return new NotificationPreference({ ...props, channels: { ...props.channels } }, id);
  }
}
