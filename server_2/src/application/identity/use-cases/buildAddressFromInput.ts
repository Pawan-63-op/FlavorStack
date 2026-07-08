import { Result } from '../../../domain/shared/Result';
import { Address } from '../../../domain/identity/value-objects/Address.vo';
import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';
import { AddressInputDto } from '../dtos/AddressDtos';

/** Build the Address VO (with coordinates) from a self-service input DTO. */
export function buildAddressFromInput(input: AddressInputDto): Result<Address> {
  const geo = GeoPoint.create(input.lat, input.lng);
  if (geo.isFailure) return Result.fail<Address>(geo.getError());

  return Address.create({
    label: input.label,
    recipientName: input.recipientName,
    phone: input.phone,
    street: input.street,
    city: input.city,
    state: input.state,
    pinCode: input.pinCode,
    landmark: input.landmark,
    deliveryInstructions: input.deliveryInstructions,
    coordinates: geo.getValue(),
  });
}
