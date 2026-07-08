import { IDriverRepository } from '../../domain/identity/repositories/IDriverRepository';
import { AvailableRidersProvider } from './SimpleDeliveryAssignmentService';

export function createAvailableDriversProvider(driverRepo: IDriverRepository): AvailableRidersProvider {
  return async (_restaurantId: string): Promise<string[]> => {
    const drivers = await driverRepo.findAvailable();
    return drivers.filter((d) => d.isOnline && !d.isBusy).map((d) => d._id);
  };
}
