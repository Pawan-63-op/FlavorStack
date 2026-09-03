import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ValidationError } from '../../../domain/shared/errors/ValidationError';
import { Address } from '../../../domain/identity/value-objects/Address.vo';
import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';
import { ICustomerAddressDirectory } from '../ports/ICustomerAddressDirectory';
import { CheckoutAddressDto } from '../dtos/CheckoutRequestDto';

/**
 * One resolution of "where is this order going?", shared by `PreviewCheckout` and
 * `Checkout` so the previewed delivery fee and the charged one are computed from the
 * same point.
 *
 * `addressId` is the supported contract: the address (and its coordinates) is read from
 * the customer's own saved address book, so a client cannot post coordinates next door to
 * the restaurant and pay the cheapest tier. The inline shape is the legacy path, kept for
 * one release; it is unverified by construction.
 */
export class DeliveryAddressResolver {
  constructor(private readonly addressDirectory: ICustomerAddressDirectory) {}

  /**
   * The delivery point only, for `PreviewCheckout` — which needs coordinates, not a full
   * address. Resolved from the saved address when `addressId` is given, so the previewed
   * fee is computed from exactly the point checkout will charge for.
   */
  async resolvePoint(input: {
    customerId: string;
    addressId?: string;
    /** @deprecated legacy client-supplied point; ignored when `addressId` is present. */
    point?: { lat: number; lng: number };
  }): Promise<Result<GeoPoint>> {
    if (input.addressId) {
      const address = await this.addressDirectory.getAddress(input.customerId, input.addressId);
      if (!address) return Result.fail<GeoPoint>(new NotFoundError('address_not_found'));
      return Result.ok<GeoPoint>(address.coordinates);
    }

    if (!input.point) {
      return Result.fail<GeoPoint>(new ValidationError('addressId is required'));
    }

    return GeoPoint.create(input.point.lat, input.point.lng);
  }

  async resolveAddress(input: {
    customerId: string;
    addressId?: string;
    /** @deprecated legacy inline address; ignored when `addressId` is present. */
    inline?: CheckoutAddressDto;
  }): Promise<Result<Address>> {
    if (input.addressId) {
      const address = await this.addressDirectory.getAddress(input.customerId, input.addressId);
      if (!address) return Result.fail<Address>(new NotFoundError('address_not_found'));
      return Result.ok<Address>(address);
    }

    if (!input.inline) {
      return Result.fail<Address>(new ValidationError('addressId is required'));
    }

    const pointResult = GeoPoint.create(input.inline.coordinates.lat, input.inline.coordinates.lng);
    if (pointResult.isFailure) return Result.fail<Address>(pointResult.getError());

    return Address.create({
      label: input.inline.label,
      street: input.inline.street,
      city: input.inline.city,
      state: input.inline.state,
      pinCode: input.inline.pinCode,
      coordinates: pointResult.getValue(),
    });
  }
}
