import { Customer } from '../../../domain/identity/entities/Customer';
import { AddressResponse } from './AddressResponse';

/** Project a Customer's address book into the API read shape (default flagged). */
export function toAddressListResponse(customer: Customer): AddressResponse[] {
  return customer.addresses.map((entry) => {
    const a = entry.address;
    return {
      id: entry.id,
      label: a.label,
      recipientName: a.recipientName,
      phone: a.phone,
      street: a.street,
      city: a.city,
      state: a.state,
      pinCode: a.pinCode,
      landmark: a.landmark,
      deliveryInstructions: a.deliveryInstructions,
      coordinates: { lat: a.coordinates.lat, lng: a.coordinates.lng },
      isDefault: entry.id === customer.defaultAddressId,
    };
  });
}
