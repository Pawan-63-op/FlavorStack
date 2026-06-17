// Immutable delivery-address snapshot copied from OrderRequested (fulfillment_module.md §2.3).
// Reuses the shared identity GeoPoint VO for coordinates (same pattern as commerce's OrderRequest).
import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { Guard } from '../../shared/Guard';
import { GeoPoint } from '../../identity/value-objects/GeoPoint.vo';

interface DeliveryAddressProps {
  label?: string;
  street: string;
  city: string;
  state: string;
  pinCode: string;
  coordinates: GeoPoint;
}

export interface CreateDeliveryAddressInput {
  label?: string;
  street: string;
  city: string;
  state: string;
  pinCode: string;
  coordinates: GeoPoint;
}

export class DeliveryAddress extends ValueObject<DeliveryAddressProps> {
  private constructor(props: DeliveryAddressProps) {
    super(props);
  }

  get label(): string | undefined {
    return this.props.label;
  }

  get street(): string {
    return this.props.street;
  }

  get city(): string {
    return this.props.city;
  }

  get state(): string {
    return this.props.state;
  }

  get pinCode(): string {
    return this.props.pinCode;
  }

  get coordinates(): GeoPoint {
    return this.props.coordinates;
  }

  public static create(input: CreateDeliveryAddressInput): Result<DeliveryAddress> {
    const checks = Guard.againstNullOrUndefinedBulk([
      { value: input.street, argName: 'Street' },
      { value: input.city, argName: 'City' },
      { value: input.state, argName: 'State' },
      { value: input.pinCode, argName: 'PinCode' },
    ]);
    if (checks.isFailure) return Result.fail<DeliveryAddress>(checks.getError());

    const streetCheck = Guard.againstEmptyString(input.street, 'Street');
    if (streetCheck.isFailure) return Result.fail<DeliveryAddress>(streetCheck.getError());

    const cityCheck = Guard.againstEmptyString(input.city, 'City');
    if (cityCheck.isFailure) return Result.fail<DeliveryAddress>(cityCheck.getError());

    const stateCheck = Guard.againstEmptyString(input.state, 'State');
    if (stateCheck.isFailure) return Result.fail<DeliveryAddress>(stateCheck.getError());

    const pinCodeCheck = Guard.againstEmptyString(input.pinCode, 'PinCode');
    if (pinCodeCheck.isFailure) return Result.fail<DeliveryAddress>(pinCodeCheck.getError());

    const coordCheck = Guard.againstNullOrUndefined(input.coordinates, 'Coordinates');
    if (coordCheck.isFailure) return Result.fail<DeliveryAddress>(coordCheck.getError());

    return Result.ok<DeliveryAddress>(
      new DeliveryAddress({
        label: input.label ? String(input.label).trim() : undefined,
        street: String(input.street).trim(),
        city: String(input.city).trim(),
        state: String(input.state).trim(),
        pinCode: String(input.pinCode).trim(),
        coordinates: input.coordinates,
      })
    );
  }
}
