import { OnUserRegistered } from '../../../../../application/identity/event-handlers/OnUserRegistered';
import { UserRegistered } from '../../../../../domain/identity/events/UserRegistered';
import { USER_ROLE } from '../../../../../domain/identity/enums/user-role.enum';
import { FakeEmailQueue } from '../../../../mocks/identity.mocks';

function makeEvent(): UserRegistered {
  return new UserRegistered('user-1', 'user@example.com', USER_ROLE.CUSTOMER, 'Test User');
}

describe('OnUserRegistered handler', () => {
  let emailQueue: FakeEmailQueue;
  let handler: OnUserRegistered;

  beforeEach(() => {
    emailQueue = new FakeEmailQueue();
    handler = new OnUserRegistered(emailQueue);
  });

  it('enqueues a welcome email job on UserRegistered', async () => {
    const event = makeEvent();

    await handler.handle(event);

    expect(emailQueue.enqueued).toHaveLength(1);
    expect(emailQueue.enqueued[0].job).toEqual({
      type: 'welcome',
      to: 'user@example.com',
      name: 'Test User',
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

  it('processes a second, distinct event normally', async () => {
    const first = makeEvent();
    const second = makeEvent();

    await handler.handle(first);
    await handler.handle(second);

    expect(emailQueue.enqueued).toHaveLength(2);
  });
});
