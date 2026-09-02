import { OnUserRegistered } from '../../../../../application/identity/event-handlers/OnUserRegistered';
import { UserRegistered } from '../../../../../domain/identity/events/UserRegistered';
import { USER_ROLE } from '../../../../../domain/identity/enums/user-role.enum';
import { FakeEmailComposer, FakeEmailQueue } from '../../../../mocks/identity.mocks';

function makeEvent(): UserRegistered {
  return new UserRegistered('user-1', 'user@example.com', USER_ROLE.CUSTOMER, 'Test User');
}

describe('OnUserRegistered handler', () => {
  let emailQueue: FakeEmailQueue;
  let composer: FakeEmailComposer;
  let handler: OnUserRegistered;

  beforeEach(() => {
    emailQueue = new FakeEmailQueue();
    composer = new FakeEmailComposer();
    handler = new OnUserRegistered(emailQueue, composer);
  });

  it('renders the welcome template and enqueues it as a generic notification job', async () => {
    const event = makeEvent();

    await handler.handle(event);

    expect(composer.calls).toEqual([{ templateKey: 'welcome', vars: { name: 'Test User' } }]);
    expect(emailQueue.enqueued).toHaveLength(1);
    expect(emailQueue.enqueued[0].job).toEqual({
      type: 'notification',
      to: 'user@example.com',
      subject: '[welcome]',
      body: '[welcome] name=Test User',
    });
  });

  it('enqueues with jobId equal to the event eventId', async () => {
    const event = makeEvent();

    await handler.handle(event);

    expect(emailQueue.enqueued[0].opts).toEqual({ jobId: event.eventId });
  });

  // Phase 6 removed the per-handler in-memory `processedEventIds` set: it was unbounded and
  // reset on restart. The durable guard is the BullMQ `jobId` asserted above — a redelivery
  // enqueues the same job id, which the queue drops.
  it('enqueues the same jobId on a redelivery, leaving de-duplication to BullMQ', async () => {
    const event = makeEvent();

    await handler.handle(event);
    await handler.handle(event);

    expect(emailQueue.enqueued.map((e) => e.opts)).toEqual([{ jobId: event.eventId }, { jobId: event.eventId }]);
  });

  it('processes a second, distinct event normally', async () => {
    const first = makeEvent();
    const second = makeEvent();

    await handler.handle(first);
    await handler.handle(second);

    expect(emailQueue.enqueued).toHaveLength(2);
  });

  it('enqueues nothing when the welcome template is missing or inactive', async () => {
    composer.missingKeys.add('welcome');

    await handler.handle(makeEvent());

    expect(emailQueue.enqueued).toHaveLength(0);
  });
});
