import { NotificationTemplate } from '../../../../domain/engagement/entities/NotificationTemplate';
import { NOTIFICATION_CHANNEL } from '../../../../domain/engagement/enums/notification-channel.enum';

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    key: 'order_confirmed',
    channel: NOTIFICATION_CHANNEL.INBOX,
    locale: 'en',
    titleTemplate: 'Order confirmed',
    bodyTemplate: 'Hi {{name}}, your order #{{orderId}} is confirmed.',
    ...overrides,
  };
}

describe('NotificationTemplate.create', () => {
  it('creates an active template by default', () => {
    const result = NotificationTemplate.create(validInput());
    expect(result.isSuccess).toBe(true);
    expect(result.getValue().active).toBe(true);
  });

  it.each([
    ['empty key', { key: '' }],
    ['empty titleTemplate', { titleTemplate: '' }],
    ['empty bodyTemplate', { bodyTemplate: '' }],
    ['empty locale', { locale: '' }],
  ])('rejects %s', (_label, overrides) => {
    expect(NotificationTemplate.create(validInput(overrides)).isFailure).toBe(true);
  });
});

describe('NotificationTemplate.render', () => {
  it('substitutes {{var}} placeholders in title and body', () => {
    const template = NotificationTemplate.create(validInput()).getValue();
    const rendered = template.render({ name: 'Asha', orderId: '42' });
    expect(rendered.title).toBe('Order confirmed');
    expect(rendered.body).toBe('Hi Asha, your order #42 is confirmed.');
  });

  it('leaves unknown placeholders untouched', () => {
    const template = NotificationTemplate.create(validInput()).getValue();
    const rendered = template.render({ name: 'Asha' });
    expect(rendered.body).toBe('Hi Asha, your order #{{orderId}} is confirmed.');
  });
});

describe('NotificationTemplate activate/deactivate', () => {
  it('deactivate() then activate() toggles the flag', () => {
    const template = NotificationTemplate.create(validInput()).getValue();
    template.deactivate();
    expect(template.active).toBe(false);
    template.activate();
    expect(template.active).toBe(true);
  });
});
