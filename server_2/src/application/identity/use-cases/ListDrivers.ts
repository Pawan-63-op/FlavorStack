import { Result } from '../../../domain/shared/Result';
import { ValidationError } from '../../../domain/shared/errors/ValidationError';
import { IDriverRepository } from '../../../domain/identity/repositories/IDriverRepository';
import { DRIVER_STATUS, DriverStatus } from '../../../domain/identity/enums/driver-status.enum';

export interface ListDriversDto {
  status?: string;
}

export interface DriverSummary {
  id: string;
  name: string;
  email: string;
  phone: string;
  driverStatus: string;
  isVerified: boolean;
  vehicle: {
    type: string;
    brand: string;
    model: string;
    licensePlate: string;
  };
  createdAt: Date;
}

export interface ListDriversResponse {
  drivers: DriverSummary[];
}

export class ListDrivers {
  constructor(private readonly driverRepo: IDriverRepository) {}

  async execute(dto: ListDriversDto): Promise<Result<ListDriversResponse>> {
    let status: DriverStatus | undefined;
    if (dto.status !== undefined) {
      const valid = (Object.values(DRIVER_STATUS) as string[]).includes(dto.status);
      if (!valid) return Result.fail(new ValidationError('invalid_driver_status'));
      status = dto.status as DriverStatus;
    }

    const drivers = await this.driverRepo.findByStatus(status);

    return Result.ok<ListDriversResponse>({
      drivers: drivers.map((d) => ({
        id: d._id,
        name: d.name,
        email: d.email,
        phone: d.phone,
        driverStatus: d.driverStatus,
        isVerified: d.isVerified,
        vehicle: {
          type: d.vehicle.type,
          brand: d.vehicle.brand,
          model: d.vehicle.model,
          licensePlate: d.vehicle.licensePlate,
        },
        createdAt: d.createdAt,
      })),
    });
  }
}
