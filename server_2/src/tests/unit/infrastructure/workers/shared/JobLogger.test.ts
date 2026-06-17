import type { Worker } from 'bullmq';

const mockInfo = jest.fn();
const mockWarn = jest.fn();
const mockError = jest.fn();

jest.mock('../../../../../infrastructure/observability/logger', () => ({
  logger: {
    info: (...args: unknown[]) => mockInfo(...args),
    warn: (...args: unknown[]) => mockWarn(...args),
    error: (...args: unknown[]) => mockError(...args),
  },
}));

import { JobLogger } from '../../../../../infrastructure/workers/shared/JobLogger';
import { QUEUE } from '../../../../../config/bullmq';

describe('JobLogger', () => {
  let handlers: Record<string, (...args: unknown[]) => void>;
  let worker: Worker;

  beforeEach(() => {
    handlers = {};
    worker = {
      on: (event: string, handler: (...args: unknown[]) => void) => {
        handlers[event] = handler;
      },
    } as unknown as Worker;
  });

  it('logs job context on active', () => {
    new JobLogger(QUEUE.email).register(worker);

    handlers.active({ id: '1', name: 'welcome', attemptsMade: 0 });

    expect(mockInfo).toHaveBeenCalledWith(
      { queue: QUEUE.email, jobId: '1', jobName: 'welcome', attemptsMade: 0 },
      'job active',
    );
  });

  it('logs job context on completed', () => {
    new JobLogger(QUEUE.email).register(worker);

    handlers.completed({ id: '1', name: 'welcome', attemptsMade: 1 });

    expect(mockInfo).toHaveBeenCalledWith(
      { queue: QUEUE.email, jobId: '1', jobName: 'welcome', attemptsMade: 1 },
      'job completed',
    );
  });

  it('logs job context and error message on failed', () => {
    new JobLogger(QUEUE.email).register(worker);

    handlers.failed({ id: '1', name: 'welcome', attemptsMade: 3 }, new Error('boom'));

    expect(mockError).toHaveBeenCalledWith(
      { queue: QUEUE.email, jobId: '1', jobName: 'welcome', attemptsMade: 3, err: 'boom' },
      'job failed',
    );
  });

  it('logs queue and jobId on stalled', () => {
    new JobLogger(QUEUE.email).register(worker);

    handlers.stalled('stalled-job-id');

    expect(mockWarn).toHaveBeenCalledWith(
      { queue: QUEUE.email, jobId: 'stalled-job-id' },
      'job stalled',
    );
  });
});
