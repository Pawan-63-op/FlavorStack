const mockSend = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn(),
}));

import { Resend } from 'resend';
import { ResendEmailProvider } from '../../../../infrastructure/external/email/ResendEmailProvider';
import { Email } from '../../../../domain/identity/value-objects/Email.vo';
import { EmailConfig } from '../../../../config/email';

describe('ResendEmailProvider', () => {
  const config: EmailConfig = {
    apiKey: 'test-api-key',
    from: 'no-reply@flavorstack.app',
    appBaseUrl: 'https://flavorstack.app',
  };

  let to: Email;

  beforeEach(() => {
    (Resend as unknown as jest.Mock).mockImplementation(() => ({
      emails: { send: mockSend },
    }));
    mockSend.mockResolvedValue({ data: { id: 'email_123' }, error: null });
    to = Email.create('user@example.com').getValue();
  });

  describe('sendVerification', () => {
    it('sends from/to/subject and a verification link containing the token', async () => {
      const provider = new ResendEmailProvider(config);

      await provider.sendVerification(to, 'verify-token-123');

      expect(mockSend).toHaveBeenCalledTimes(1);
      const payload = mockSend.mock.calls[0][0];
      expect(payload.from).toBe(config.from);
      expect(payload.to).toBe('user@example.com');
      expect(payload.subject).toBe('Verify your email');
      expect(payload.html).toContain(`${config.appBaseUrl}/verify-email?token=verify-token-123`);
      expect(payload.text).toContain(`${config.appBaseUrl}/verify-email?token=verify-token-123`);
    });
  });

  describe('sendNotification', () => {
    it('sends the given subject and body as-is', async () => {
      const provider = new ResendEmailProvider(config);

      await provider.sendNotification(to, 'Order Shipped', 'Your order is on the way');

      expect(mockSend).toHaveBeenCalledTimes(1);
      const payload = mockSend.mock.calls[0][0];
      expect(payload.from).toBe(config.from);
      expect(payload.to).toBe('user@example.com');
      expect(payload.subject).toBe('Order Shipped');
      expect(payload.html).toContain('Your order is on the way');
      expect(payload.text).toContain('Your order is on the way');
    });
  });

  describe('error propagation', () => {
    it('throws when the Resend SDK returns an error response', async () => {
      mockSend.mockResolvedValue({
        data: null,
        error: { message: 'Invalid API key', statusCode: 401, name: 'invalid_api_key' },
      });
      const provider = new ResendEmailProvider(config);

      await expect(provider.sendNotification(to, 'Subject', 'Body')).rejects.toThrow('Invalid API key');
    });
  });
});
