const mockInfo = jest.fn();

jest.mock('../../../../infrastructure/observability/logger', () => ({
  logger: { info: (...args: unknown[]) => mockInfo(...args) },
}));

import { LoggerPushProvider } from '../../../../infrastructure/external/push/LoggerPushProvider';

describe('LoggerPushProvider', () => {
  beforeEach(() => {
    mockInfo.mockClear();
  });

  it('logs a push.sent event with the device token and title', async () => {
    const provider = new LoggerPushProvider();

    await provider.sendPush('device-token-123', 'Order update', 'Your order is on its way', {
      orderId: 'order-1',
    });

    expect(mockInfo).toHaveBeenCalledTimes(1);
    const payload = mockInfo.mock.calls[0][0];
    expect(payload).toEqual({
      event: 'push.sent',
      token: 'device-token-123',
      title: 'Order update',
    });
  });

  it('never logs the push body', async () => {
    const provider = new LoggerPushProvider();

    await provider.sendPush('device-token-123', 'Order update', 'SECRET-BODY-CONTENT');

    const allLoggedArgs = mockInfo.mock.calls.flat();
    for (const arg of allLoggedArgs) {
      expect(JSON.stringify(arg)).not.toContain('SECRET-BODY-CONTENT');
    }
  });
});
