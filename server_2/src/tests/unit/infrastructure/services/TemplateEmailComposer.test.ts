import { TemplateEmailComposer } from '../../../../infrastructure/services/TemplateEmailComposer';
import { INotificationTemplateRepository } from '../../../../domain/engagement/repositories/INotificationTemplateRepository';
import { NotificationTemplate } from '../../../../domain/engagement/entities/NotificationTemplate';
import { NOTIFICATION_CHANNEL } from '../../../../domain/engagement/enums/notification-channel.enum';

function makeRepo(): jest.Mocked<INotificationTemplateRepository> {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    findByKeyChannelLocale: jest.fn().mockResolvedValue(null),
  };
}

function passwordResetTemplate(): NotificationTemplate {
  const result = NotificationTemplate.create({
    key: 'password_reset',
    channel: NOTIFICATION_CHANNEL.EMAIL,
    locale: 'en',
    titleTemplate: 'Reset your password',
    bodyTemplate: 'Your code is {{code}}. Enter it at {{resetUrl}}.',
  });
  return result.getValue();
}

describe('TemplateEmailComposer', () => {
  it('resolves the EMAIL template for the key and returns the rendered subject and body', async () => {
    const repo = makeRepo();
    repo.findByKeyChannelLocale.mockResolvedValue(passwordResetTemplate());
    const composer = new TemplateEmailComposer(repo);

    const composed = await composer.compose('password_reset', {
      code: '123456',
      resetUrl: 'https://app.test/reset-password?email=a%40b.com',
    });

    expect(repo.findByKeyChannelLocale).toHaveBeenCalledWith('password_reset', NOTIFICATION_CHANNEL.EMAIL, 'en');
    expect(composed).toEqual({
      subject: 'Reset your password',
      body: 'Your code is 123456. Enter it at https://app.test/reset-password?email=a%40b.com.',
    });
  });

  it('returns null when no template exists for the key', async () => {
    const repo = makeRepo();
    const composer = new TemplateEmailComposer(repo);

    await expect(composer.compose('password_reset', {})).resolves.toBeNull();
  });

  it('returns null when the template exists but is inactive', async () => {
    const template = passwordResetTemplate();
    template.deactivate();
    const repo = makeRepo();
    repo.findByKeyChannelLocale.mockResolvedValue(template);
    const composer = new TemplateEmailComposer(repo);

    await expect(composer.compose('password_reset', { code: '123456' })).resolves.toBeNull();
  });

  it('honours a non-default locale', async () => {
    const repo = makeRepo();
    const composer = new TemplateEmailComposer(repo, 'fr');

    await composer.compose('welcome', {});

    expect(repo.findByKeyChannelLocale).toHaveBeenCalledWith('welcome', NOTIFICATION_CHANNEL.EMAIL, 'fr');
  });
});
