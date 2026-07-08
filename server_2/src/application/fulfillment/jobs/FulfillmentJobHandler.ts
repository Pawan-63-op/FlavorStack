import { FulfillmentJob } from './FulfillmentJob';
import { HandleAssignmentTimeout } from '../use-cases/HandleAssignmentTimeout';
import { HandleSlaTimeout } from '../use-cases/HandleSlaTimeout';

export class FulfillmentJobHandler {
  constructor(
    private readonly handleAssignmentTimeout: HandleAssignmentTimeout,
    private readonly handleSlaTimeout: HandleSlaTimeout
  ) {}

  async handle(job: FulfillmentJob): Promise<void> {
    switch (job.type) {
      case 'assignment-timeout': {
        const result = await this.handleAssignmentTimeout.execute({
          fulfillmentId: job.fulfillmentId,
          attempt: job.attempt,
        });
        if (result.isFailure) throw result.getError();
        return;
      }
      case 'sla-timeout': {
        const result = await this.handleSlaTimeout.execute({
          fulfillmentId: job.fulfillmentId,
          stage: job.stage,
        });
        if (result.isFailure) throw result.getError();
        return;
      }
    }
  }
}
