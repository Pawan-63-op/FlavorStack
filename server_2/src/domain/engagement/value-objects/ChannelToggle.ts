import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { ValidationError } from '../../shared/errors/ValidationError';
import { NOTIFICATION_CHANNEL, NotificationChannelValue } from '../enums/notification-channel.enum';

interface ChannelToggleProps {
  inbox: boolean;
  email: boolean;
}

export interface CreateChannelToggleInput {
  inbox: boolean;
  email: boolean;
}

export class ChannelToggle extends ValueObject<ChannelToggleProps> {
  private constructor(props: ChannelToggleProps) {
    super(props);
  }

  public static create(input: CreateChannelToggleInput): Result<ChannelToggle> {
    if (typeof input.inbox !== 'boolean' || typeof input.email !== 'boolean') {
      return Result.fail<ChannelToggle>(new ValidationError('ChannelToggle inbox/email flags must be booleans'));
    }
    return Result.ok<ChannelToggle>(new ChannelToggle({ inbox: input.inbox, email: input.email }));
  }

  public static allEnabled(): ChannelToggle {
    return new ChannelToggle({ inbox: true, email: true });
  }

  public static inboxOnly(): ChannelToggle {
    return new ChannelToggle({ inbox: true, email: false });
  }

  public isEnabled(channel: NotificationChannelValue): boolean {
    return channel === NOTIFICATION_CHANNEL.INBOX ? this.props.inbox : this.props.email;
  }

  public withChannel(channel: NotificationChannelValue, enabled: boolean): ChannelToggle {
    return channel === NOTIFICATION_CHANNEL.INBOX
      ? new ChannelToggle({ inbox: enabled, email: this.props.email })
      : new ChannelToggle({ inbox: this.props.inbox, email: enabled });
  }
}
