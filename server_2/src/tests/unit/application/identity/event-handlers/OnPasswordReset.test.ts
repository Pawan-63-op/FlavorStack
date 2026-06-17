import { OnPasswordReset } from '../../../../../application/identity/event-handlers/OnPasswordReset';
import { PasswordResetRequested } from '../../../../../domain/identity/events/PasswordResetRequested';
import { FakeEmailQueue } from '../../../../mocks/identity.mocks';

function makeEvent(): PasswordResetRequested {
  return new PasswordResetRequested('user-1', 'user@example.com', new Date());
}

describe('OnPasswordReset handler', () => {
  let emailQueue: FakeEmailQueue;
  let handler: OnPasswordReset;

  beforeEach(() => {
    emailQueue = new FakeEmailQueue();
    handler = new OnPasswordReset(emailQueue);
  });

  it('enqueues a password-reset email job on PasswordResetRequested', async () => {
    const event = makeEvent();

    await handler.handle(event);

    expect(emailQueue.enqueued).toHaveLength(1);
    expect(emailQueue.enqueued[0].job).toEqual({
      type: 'password-reset',
      to: 'user@example.com',
    });
  });

  it('enqueues with jobId equal to the event eventId', async () => {
    const event = makeEvent();

    await handler.handle(event);

    expect(emailQueue.enqueued[0].opts).toEqual({ jobId: event.eventId });
  });

  it('is idempotent — does not enqueue twice for the same eventId', async () => {
    const event = makeEvent();

    await handler.handle(event);
    await handler.handle(event);

    expect(emailQueue.enqueued).toHaveLength(1);
  });
});
