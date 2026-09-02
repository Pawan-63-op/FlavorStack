import { ChannelToggle } from '../../../../../domain/engagement/value-objects/ChannelToggle';
import { NOTIFICATION_CHANNEL } from '../../../../../domain/engagement/enums/notification-channel.enum';

describe('ChannelToggle', () => {
  it('creates with explicit inbox/email flags', () => {
    const result = ChannelToggle.create({ inbox: true, email: false });
    expect(result.isSuccess).toBe(true);
    const toggle = result.getValue();
    expect(toggle.isEnabled(NOTIFICATION_CHANNEL.INBOX)).toBe(true);
    expect(toggle.isEnabled(NOTIFICATION_CHANNEL.EMAIL)).toBe(false);
  });

  it('rejects non-boolean flags', () => {
    const result = ChannelToggle.create({ inbox: 'yes' as unknown as boolean, email: false });
    expect(result.isFailure).toBe(true);
  });

  it('withChannel returns a new toggle with the channel flipped', () => {
    const toggle = ChannelToggle.create({ inbox: true, email: true }).getValue();
    const updated = toggle.withChannel(NOTIFICATION_CHANNEL.EMAIL, false);
    expect(updated.isEnabled(NOTIFICATION_CHANNEL.EMAIL)).toBe(false);
    expect(updated.isEnabled(NOTIFICATION_CHANNEL.INBOX)).toBe(true);
    expect(toggle.isEnabled(NOTIFICATION_CHANNEL.EMAIL)).toBe(true);
  });

  it('allBoth() / inboxOnly() factories', () => {
    expect(ChannelToggle.allEnabled().isEnabled(NOTIFICATION_CHANNEL.INBOX)).toBe(true);
    expect(ChannelToggle.allEnabled().isEnabled(NOTIFICATION_CHANNEL.EMAIL)).toBe(true);
    expect(ChannelToggle.inboxOnly().isEnabled(NOTIFICATION_CHANNEL.INBOX)).toBe(true);
    expect(ChannelToggle.inboxOnly().isEnabled(NOTIFICATION_CHANNEL.EMAIL)).toBe(false);
  });
});
