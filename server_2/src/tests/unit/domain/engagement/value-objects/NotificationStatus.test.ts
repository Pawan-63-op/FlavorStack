import { NotificationStatus } from '../../../../../domain/engagement/value-objects/NotificationStatus';
import { NOTIFICATION_STATUS } from '../../../../../domain/engagement/enums/notification-status.enum';

describe('NotificationStatus', () => {
  it('starts PENDING via pending()', () => {
    expect(NotificationStatus.pending().value).toBe(NOTIFICATION_STATUS.PENDING);
  });

  it('rejects an invalid status value', () => {
    expect(NotificationStatus.create('BOGUS' as any).isFailure).toBe(true);
  });

  it.each([
    [NOTIFICATION_STATUS.PENDING, NOTIFICATION_STATUS.SENT, true],
    [NOTIFICATION_STATUS.PENDING, NOTIFICATION_STATUS.FAILED, true],
    [NOTIFICATION_STATUS.PENDING, NOTIFICATION_STATUS.READ, false],
    [NOTIFICATION_STATUS.SENT, NOTIFICATION_STATUS.READ, true],
    [NOTIFICATION_STATUS.SENT, NOTIFICATION_STATUS.FAILED, false],
    [NOTIFICATION_STATUS.FAILED, NOTIFICATION_STATUS.SENT, false],
    [NOTIFICATION_STATUS.READ, NOTIFICATION_STATUS.SENT, false],
  ])('%s -> %s allowed=%s', (from, to, allowed) => {
    const status = NotificationStatus.create(from).getValue();
    expect(status.canTransitionTo(to)).toBe(allowed);
    const transition = status.transitionTo(to);
    expect(transition.isSuccess).toBe(allowed);
  });

  it('FAILED and READ are terminal', () => {
    expect(NotificationStatus.create(NOTIFICATION_STATUS.FAILED).getValue().isTerminal()).toBe(true);
    expect(NotificationStatus.create(NOTIFICATION_STATUS.READ).getValue().isTerminal()).toBe(true);
    expect(NotificationStatus.pending().isTerminal()).toBe(false);
  });
});
