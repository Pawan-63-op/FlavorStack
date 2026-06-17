import { registerIdentityEventHandlers } from '../../../../../application/identity/event-handlers/EventRegistry';
import { UserRegistered } from '../../../../../domain/identity/events/UserRegistered';
import { PasswordResetRequested } from '../../../../../domain/identity/events/PasswordResetRequested';
import { USER_ROLE } from '../../../../../domain/identity/enums/user-role.enum';
import { FakeEmailQueue } from '../../../../mocks/identity.mocks';
import { createEventBusSpy, EventBusSpy } from '../../../../mocks/shared.mocks';

describe('Identity EventRegistry', () => {
  let emailQueue: FakeEmailQueue;
  let eventBus: EventBusSpy;

  beforeEach(() => {
    emailQueue = new FakeEmailQueue();
    eventBus = createEventBusSpy();
    registerIdentityEventHandlers(eventBus, emailQueue);
  });

  it('invokes OnUserRegistered exactly once when UserRegistered is published', async () => {
    const event = new UserRegistered('user-1', 'user@example.com', USER_ROLE.CUSTOMER, 'Test User');

    await eventBus.publish(event);

    expect(emailQueue.enqueued).toHaveLength(1);
    expect(emailQueue.enqueued[0].job).toMatchObject({ type: 'welcome', to: 'user@example.com' });
  });

  it('invokes OnPasswordReset exactly once when PasswordResetRequested is published', async () => {
    const event = new PasswordResetRequested('user-1', 'user@example.com', new Date());

    await eventBus.publish(event);

    expect(emailQueue.enqueued).toHaveLength(1);
    expect(emailQueue.enqueued[0].job).toMatchObject({ type: 'password-reset', to: 'user@example.com' });
  });

  it('isolates a failing handler — other handlers and the bus remain functional', async () => {
    const failingBus = createEventBusSpy();
    failingBus.subscribe('UserRegistered', async () => {
      throw new Error('boom');
    });
    registerIdentityEventHandlers(failingBus, emailQueue);

    const event = new UserRegistered('user-1', 'user@example.com', USER_ROLE.CUSTOMER, 'Test User');

    await expect(failingBus.publish(event)).resolves.toBeUndefined();
    expect(emailQueue.enqueued).toHaveLength(1);
  });
});
