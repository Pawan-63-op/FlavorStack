import { ModerationStatus } from '../../../../../domain/engagement/value-objects/ModerationStatus';
import { MODERATION_STATUS } from '../../../../../domain/engagement/enums/moderation-status.enum';

describe('ModerationStatus', () => {
  it('starts PENDING via pending()', () => {
    expect(ModerationStatus.pending().value).toBe(MODERATION_STATUS.PENDING);
  });

  it('starts AUTO_FLAGGED via autoFlagged()', () => {
    expect(ModerationStatus.autoFlagged().value).toBe(MODERATION_STATUS.AUTO_FLAGGED);
  });

  it('rejects an invalid status value', () => {
    expect(ModerationStatus.create('BOGUS' as any).isFailure).toBe(true);
  });

  it.each([
    [MODERATION_STATUS.PENDING, MODERATION_STATUS.APPROVED, true],
    [MODERATION_STATUS.PENDING, MODERATION_STATUS.REJECTED, true],
    [MODERATION_STATUS.AUTO_FLAGGED, MODERATION_STATUS.APPROVED, true],
    [MODERATION_STATUS.AUTO_FLAGGED, MODERATION_STATUS.REJECTED, true],
    [MODERATION_STATUS.APPROVED, MODERATION_STATUS.REJECTED, false],
    [MODERATION_STATUS.REJECTED, MODERATION_STATUS.APPROVED, false],
  ])('%s -> %s allowed=%s', (from, to, allowed) => {
    const status = ModerationStatus.create(from).getValue();
    expect(status.transitionTo(to).isSuccess).toBe(allowed);
  });

  it('APPROVED/REJECTED are terminal', () => {
    expect(ModerationStatus.create(MODERATION_STATUS.APPROVED).getValue().isTerminal()).toBe(true);
    expect(ModerationStatus.create(MODERATION_STATUS.REJECTED).getValue().isTerminal()).toBe(true);
    expect(ModerationStatus.pending().isTerminal()).toBe(false);
  });
});
