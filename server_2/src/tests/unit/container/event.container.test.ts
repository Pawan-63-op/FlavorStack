import { createEventContainer, wireIdentityEventHandlers } from '../../../container/event.container';
import { InMemoryEventBus } from '../../../application/shared/events/InMemoryEventBus';
import { FakeEmailComposer, FakeEmailQueue, InMemoryUserRepository } from '../../mocks/identity.mocks';
import { UserRegistered } from '../../../domain/identity/events/UserRegistered';
import { USER_ROLE } from '../../../domain/identity/enums/user-role.enum';

describe('createEventContainer', () => {
  it('returns an eventBus backed by InMemoryEventBus', () => {
    const container = createEventContainer();

    expect(container.eventBus).toBeInstanceOf(InMemoryEventBus);
  });
});

describe('wireIdentityEventHandlers', () => {
  it('subscribes the identity handlers so a UserRegistered event enqueues a welcome email job', async () => {
    const { eventBus } = createEventContainer();
    const emailQueue = new FakeEmailQueue();

    wireIdentityEventHandlers(eventBus, {
      emailQueue,
      emailComposer: new FakeEmailComposer(),
      userRepository: new InMemoryUserRepository(),
    });

    const event = new UserRegistered('user-1', 'new-user@example.com', USER_ROLE.CUSTOMER, 'New User');
    await eventBus.publish(event);

    expect(emailQueue.enqueued).toHaveLength(1);
    expect(emailQueue.enqueued[0].job).toMatchObject({ type: 'notification', to: 'new-user@example.com' });
    expect(emailQueue.enqueued[0].opts).toEqual({ jobId: event.eventId });
  });
});
