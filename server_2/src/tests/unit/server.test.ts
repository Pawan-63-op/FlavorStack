const mockApp = {} as unknown;

const mockBootstrap = jest.fn().mockResolvedValue(mockApp);
const mockShutdown = jest.fn().mockResolvedValue(undefined);
jest.mock('../../container', () => ({
  bootstrap: mockBootstrap,
  shutdown: mockShutdown,
}));

const mockListen = jest.fn((_port: number, cb: () => void) => {
  cb();
  return { close: jest.fn((closeCb: () => void) => closeCb()) };
});
const mockCreateApp = jest.fn(() => ({ listen: mockListen }));
jest.mock('../../app', () => ({
  createApp: mockCreateApp,
}));

jest.mock('../../infrastructure/observability/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

describe('server entrypoint', () => {
  it('bootstraps with startOutboxProcessor disabled so the API never runs a poller', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    mockBootstrap.mockResolvedValue(mockApp);
    mockShutdown.mockResolvedValue(undefined);
    mockCreateApp.mockReturnValue({ listen: mockListen });

    await jest.isolateModulesAsync(async () => {
      await import('../../server');
    });
    // allow the fire-and-forget main().catch(...) chain to settle
    await new Promise((resolve) => setImmediate(resolve));

    expect(mockBootstrap).toHaveBeenCalledWith({ startOutboxProcessor: false });
    expect(mockCreateApp).toHaveBeenCalledWith(mockApp);

    exitSpy.mockRestore();
  });
});
