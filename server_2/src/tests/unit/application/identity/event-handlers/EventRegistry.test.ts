import { registerIdentityEventHandlers } from '../../../../../application/identity/event-handlers/EventRegistry';
import { UserRegistered } from '../../../../../domain/identity/events/UserRegistered';
import { PasswordChanged } from '../../../../../domain/identity/events/PasswordChanged';
import { USER_ROLE } from '../../../../../domain/identity/enums/user-role.enum';
import { Customer } from '../../../../../domain/identity/entities/Customer';
import {
  FakeEmailComposer,
  FakeEmailQueue,
  InMemoryUserRepository,
} from '../../../../mocks/identity.mocks';
import { createEventBusSpy, EventBusSpy } from '../../../../mocks/shared.mocks';

function makeCustomer(): Customer {
  const customer = Customer.create({
    name: 'Test User',
    email: 'user@example.com',
    phone: '+919876543210',
    passwordHash: 'hashed:Password1!',
    referralCode: 'REF00001',
  });
  customer.pullDomainEvents();
  return customer;
}

describe('Identity EventRegistry', () => {
  let emailQueue: FakeEmailQueue;
  let emailComposer: FakeEmailComposer;
  let userRepository: InMemoryUserRepository;
  let eventBus: EventBusSpy;

  beforeEach(() => {
    emailQueue = new FakeEmailQueue();
    emailComposer = new FakeEmailComposer();
    userRepository = new InMemoryUserRepository();
    eventBus = createEventBusSpy();
    registerIdentityEventHandlers(eventBus, { emailQueue, emailComposer, userRepository });
  });

  it('invokes OnUserRegistered exactly once when UserRegistered is published', async () => {
    const event = new UserRegistered('user-1', 'user@example.com', USER_ROLE.CUSTOMER, 'Test User');

    await eventBus.publish(event);

    expect(emailQueue.enqueued).toHaveLength(1);
    expect(emailQueue.enqueued[0].job).toMatchObject({ type: 'notification', to: 'user@example.com' });
  });

  it('invokes OnPasswordChanged exactly once when PasswordChanged is published', async () => {
    const customer = makeCustomer();
    await userRepository.save(customer);

    await eventBus.publish(new PasswordChanged(customer._id, new Date()));

    expect(emailQueue.enqueued).toHaveLength(1);
    expect(emailQueue.enqueued[0].job).toMatchObject({ type: 'notification', to: customer.email });
  });

  it('isolates a failing handler — other handlers and the bus remain functional', async () => {
    const failingBus = createEventBusSpy();
    failingBus.subscribe('UserRegistered', async () => {
      throw new Error('boom');
    });
    registerIdentityEventHandlers(failingBus, { emailQueue, emailComposer, userRepository });

    const event = new UserRegistered('user-1', 'user@example.com', USER_ROLE.CUSTOMER, 'Test User');

    await expect(failingBus.publish(event)).resolves.toBeUndefined();
    expect(emailQueue.enqueued).toHaveLength(1);
  });
});
