import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { ValidationError } from '../../shared/errors/ValidationError';
import { NOTIFICATION_CHANNEL, NotificationChannelValue } from '../enums/notification-channel.enum';

interface ChannelToggleProps {
  push: boolean;
  email: boolean;
}

export interface CreateChannelToggleInput {
  push: boolean;
  email: boolean;
}

export class ChannelToggle extends ValueObject<ChannelToggleProps> {
  private constructor(props: ChannelToggleProps) {
    super(props);
  }

  public static create(input: CreateChannelToggleInput): Result<ChannelToggle> {
    if (typeof input.push !== 'boolean' || typeof input.email !== 'boolean') {
      return Result.fail<ChannelToggle>(new ValidationError('ChannelToggle push/email flags must be booleans'));
    }
    return Result.ok<ChannelToggle>(new ChannelToggle({ push: input.push, email: input.email }));
  }

  public static allEnabled(): ChannelToggle {
    return new ChannelToggle({ push: true, email: true });
  }

  public static pushOnly(): ChannelToggle {
    return new ChannelToggle({ push: true, email: false });
  }

  public isEnabled(channel: NotificationChannelValue): boolean {
    return channel === NOTIFICATION_CHANNEL.PUSH ? this.props.push : this.props.email;
  }

  public withChannel(channel: NotificationChannelValue, enabled: boolean): ChannelToggle {
    return channel === NOTIFICATION_CHANNEL.PUSH
      ? new ChannelToggle({ push: enabled, email: this.props.email })
      : new ChannelToggle({ push: this.props.push, email: enabled });
  }
}
