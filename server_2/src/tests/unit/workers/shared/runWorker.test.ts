const mockInfo = jest.fn();
const mockWarn = jest.fn();
const mockError = jest.fn();

jest.mock('../../../../infrastructure/observability/logger', () => ({
  logger: {
    info: (...args: unknown[]) => mockInfo(...args),
    warn: (...args: unknown[]) => mockWarn(...args),
    error: (...args: unknown[]) => mockError(...args),
  },
}));

import { runWorker } from '../../../../workers/shared/runWorker';

describe('runWorker', () => {
  let signalHandlers: Record<string, Array<(...args: unknown[]) => void>>;
  let exitSpy: jest.SpyInstance;

  beforeEach(() => {
    signalHandlers = {};
    mockInfo.mockClear();
    mockWarn.mockClear();
    mockError.mockClear();

    jest.spyOn(process, 'on').mockImplementation((event: string | symbol, handler: (...args: unknown[]) => void) => {
      (signalHandlers[String(event)] ??= []).push(handler);
      return process;
    });
    exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('registers SIGTERM and SIGINT handlers', () => {
    runWorker(jest.fn().mockResolvedValue(undefined));

    expect(signalHandlers.SIGTERM).toHaveLength(1);
    expect(signalHandlers.SIGINT).toHaveLength(1);
  });

  it('calls shutdown and exits 0 on SIGTERM', async () => {
    const shutdown = jest.fn().mockResolvedValue(undefined);
    runWorker(shutdown);

    await signalHandlers.SIGTERM[0]('SIGTERM');
    await Promise.resolve();
    await Promise.resolve();

    expect(shutdown).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('ignores a second signal once shutdown is already in progress', async () => {
    const shutdown = jest.fn().mockResolvedValue(undefined);
    runWorker(shutdown);

    await signalHandlers.SIGTERM[0]('SIGTERM');
    await signalHandlers.SIGINT[0]('SIGINT');
    await Promise.resolve();
    await Promise.resolve();

    expect(shutdown).toHaveBeenCalledTimes(1);
  });

  it('exits 1 if shutdown rejects', async () => {
    const shutdown = jest.fn().mockRejectedValue(new Error('shutdown failed'));
    runWorker(shutdown);

    await signalHandlers.SIGTERM[0]('SIGTERM');
    await Promise.resolve();
    await Promise.resolve();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(mockError).toHaveBeenCalled();
  });

  it('force-exits 1 if shutdown hangs past the timeout', async () => {
    jest.useFakeTimers();
    const shutdown = jest.fn().mockReturnValue(new Promise(() => {}));
    runWorker(shutdown);

    await signalHandlers.SIGTERM[0]('SIGTERM');
    jest.runOnlyPendingTimers();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('logs unhandled rejections and uncaught exceptions without crashing', () => {
    runWorker(jest.fn().mockResolvedValue(undefined));

    signalHandlers.unhandledRejection[0](new Error('boom'));
    signalHandlers.uncaughtException[0](new Error('fatal'));

    expect(mockError).toHaveBeenCalledTimes(2);
  });
});
