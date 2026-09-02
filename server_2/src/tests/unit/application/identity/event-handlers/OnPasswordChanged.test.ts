import { OnPasswordChanged } from '../../../../../application/identity/event-handlers/OnPasswordChanged';
import { PasswordChanged } from '../../../../../domain/identity/events/PasswordChanged';
import { Customer } from '../../../../../domain/identity/entities/Customer';
import {
  FakeEmailComposer,
  FakeEmailQueue,
  InMemoryUserRepository,
} from '../../../../mocks/identity.mocks';

const CHANGED_AT = new Date('2026-08-23T10:00:00.000Z');

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

describe('OnPasswordChanged handler (identity)', () => {
  let emailQueue: FakeEmailQueue;
  let composer: FakeEmailComposer;
  let users: InMemoryUserRepository;
  let handler: OnPasswordChanged;
  let customer: Customer;

  beforeEach(async () => {
    emailQueue = new FakeEmailQueue();
    composer = new FakeEmailComposer();
    users = new InMemoryUserRepository();
    handler = new OnPasswordChanged(users, emailQueue, composer);
    customer = makeCustomer();
    await users.save(customer);
  });

  it('resolves the recipient, renders password_changed, and enqueues one email', async () => {
    const event = new PasswordChanged(customer._id, CHANGED_AT);

    await handler.handle(event);

    expect(composer.calls).toEqual([
      { templateKey: 'password_changed', vars: { changedAt: CHANGED_AT.toISOString() } },
    ]);
    expect(emailQueue.enqueued).toHaveLength(1);
    expect(emailQueue.enqueued[0].job).toEqual({
      type: 'notification',
      to: customer.email,
      subject: '[password_changed]',
      body: `[password_changed] changedAt=${CHANGED_AT.toISOString()}`,
    });
    expect(emailQueue.enqueued[0].opts).toEqual({ jobId: event.eventId });
  });

  // Phase 6 removed the per-handler in-memory `processedEventIds` set: it was unbounded and
  // reset on restart. The durable guard is the BullMQ `jobId` asserted above — a redelivery
  // enqueues the same job id, which the queue drops.
  it('enqueues the same jobId on a redelivery, leaving de-duplication to BullMQ', async () => {
    const event = new PasswordChanged(customer._id, CHANGED_AT);

    await handler.handle(event);
    await handler.handle(event);

    expect(emailQueue.enqueued.map((e) => e.opts)).toEqual([{ jobId: event.eventId }, { jobId: event.eventId }]);
  });

  it('enqueues nothing when the user cannot be resolved', async () => {
    await handler.handle(new PasswordChanged('missing-user', CHANGED_AT));

    expect(emailQueue.enqueued).toHaveLength(0);
  });

  it('enqueues nothing when the password_changed template is missing or inactive', async () => {
    composer.missingKeys.add('password_changed');

    await handler.handle(new PasswordChanged(customer._id, CHANGED_AT));

    expect(emailQueue.enqueued).toHaveLength(0);
  });
});
