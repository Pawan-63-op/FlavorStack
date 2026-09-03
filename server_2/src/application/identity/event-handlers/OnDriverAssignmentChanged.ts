import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { DomainError } from '../../../domain/shared/errors/DomainError';
import { IUserRepository } from '../../../domain/identity/repositories/IUserRepository';
import { IDriverRepository } from '../../../domain/identity/repositories/IDriverRepository';
import { Driver } from '../../../domain/identity/entities/Driver';
import { logger } from '../../../infrastructure/observability/logger';

/**
 * Keeps `Driver.activeOrderId` — and therefore `isBusy` — in step with the fulfillment lifecycle.
 *
 * Until Phase 10.4 `Driver.assignOrder` / `completeDelivery` / `cancelDelivery` had **no production
 * caller at all**: `isBusy` was permanently false, `AvailableDriversProvider`'s `!d.isBusy` filter
 * was a no-op, one driver could be offered every order in the system simultaneously, and
 * `totalDeliveries` never incremented. This handler is the missing caller.
 *
 * It reacts to fulfillment events but lives in identity and touches only identity aggregates —
 * the ordinary cross-context integration path. Every failure is logged and swallowed: a rider's
 * busy flag must never be the reason a delivery event fails to be processed.
 */
export class OnDriverAssignmentChanged {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly driverRepo: IDriverRepository
  ) {}

  /** `RiderAssigned` — the rider is now on this job. */
  async onAssigned(event: DomainEvent): Promise<void> {
    const riderId = (event as { riderId?: string }).riderId;
    if (!riderId) return;

    await this.mutate(event, riderId, (driver) => {
      if (driver.getActiveOrder() === event.aggregateId) return false; // already recorded
      driver.assignOrder(event.aggregateId);
      return true;
    });
  }

  /** `DeliveryCompleted` — frees the rider and credits the delivery to their count. */
  async onCompleted(event: DomainEvent): Promise<void> {
    const riderId = (event as { riderId?: string }).riderId;
    if (!riderId) return;

    await this.mutate(event, riderId, (driver) => {
      if (driver.getActiveOrder() !== event.aggregateId) return false;
      driver.completeDelivery();
      return true;
    });
  }

  /**
   * `DeliveryFailed` / `FulfillmentCancelled` / `RiderReassigned` — the rider is off this job but
   * it was not delivered, so `totalDeliveries` must not move. `FulfillmentCancelled` names no
   * rider, and `RiderReassigned` names the *previous* one, so both resolve the driver by the order
   * they are still holding.
   */
  async onReleased(event: DomainEvent): Promise<void> {
    const named =
      (event as { previousRiderId?: string }).previousRiderId ??
      (event as { riderId?: string | null }).riderId ??
      null;

    const driver = named
      ? await this.loadDriver(named)
      : await this.driverRepo.findByActiveOrder(event.aggregateId);
    if (!driver) return;

    await this.persist(event, driver, () => {
      if (driver.getActiveOrder() !== event.aggregateId) return false;
      driver.cancelDelivery();
      return true;
    });
  }

  private async mutate(
    event: DomainEvent,
    riderId: string,
    apply: (driver: Driver) => boolean
  ): Promise<void> {
    const driver = await this.loadDriver(riderId);
    if (!driver) {
      logger.warn(
        { eventId: event.eventId, eventName: event.eventName, riderId },
        '[OnDriverAssignmentChanged] rider not found — skipping'
      );
      return;
    }
    await this.persist(event, driver, apply);
  }

  private async loadDriver(riderId: string): Promise<Driver | null> {
    const user = await this.userRepo.findById(riderId);
    return user instanceof Driver ? user : null;
  }

  private async persist(
    event: DomainEvent,
    driver: Driver,
    apply: (driver: Driver) => boolean
  ): Promise<void> {
    try {
      if (!apply(driver)) return; // already in the target state — a replay, not a failure
      await this.userRepo.update(driver);
    } catch (err) {
      logger.error(
        {
          eventId: event.eventId,
          eventName: event.eventName,
          riderId: driver._id,
          err: err instanceof DomainError ? err.message : String(err),
        },
        '[OnDriverAssignmentChanged] could not update rider busy state'
      );
    }
  }
}
