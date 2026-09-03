export interface PickNextRiderInput {
  restaurantId: string;
  excludeRiderIds: string[];
}

export interface IDeliveryAssignmentService {
  /** The next candidate for this restaurant, nearest first, excluding riders already tried. */
  pickNextRider(input: PickNextRiderInput): Promise<string | null>;

  /**
   * Would `riderId` have been a legitimate candidate for this restaurant right now? Guards the
   * admin-supplied `riderId` path, which otherwise offers a delivery to any string — a customer's
   * id, an offline rider, or one already on another job.
   */
  isRiderAssignable(riderId: string, restaurantId: string): Promise<boolean>;
}
