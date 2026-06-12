import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { Guard } from '../../shared/Guard';
import { ValidationError } from '../../shared/errors/ValidationError';
import { GeoPoint } from './GeoPoint.vo';

interface AddressProps {
  label?: string;
  street: string;
  city: string;
  state: string;
  pinCode: string;
  coordinates: GeoPoint;
}

export class Address extends ValueObject<AddressProps> {
  private constructor(props: AddressProps) {
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

  public toString(): string {
    const labelStr = this.props.label ? `[${this.props.label}] ` : '';
    return `${labelStr}${this.props.street}, ${this.props.city}, ${this.props.state} - ${this.props.pinCode}`;
  }

  public static create(props: {
    label?: string;
    street: string;
    city: string;
    state: string;
    pinCode: string;
    coordinates: GeoPoint;
  }): Result<Address> {
    const streetCheck = Guard.againstEmptyString(props.street, 'Street');
    if (streetCheck.isFailure) return Result.fail<Address>(streetCheck.getError());

    const cityCheck = Guard.againstEmptyString(props.city, 'City');
    if (cityCheck.isFailure) return Result.fail<Address>(cityCheck.getError());

    const stateCheck = Guard.againstEmptyString(props.state, 'State');
    if (stateCheck.isFailure) return Result.fail<Address>(stateCheck.getError());

    const pinCodeCheck = Guard.againstEmptyString(props.pinCode, 'PinCode');
    if (pinCodeCheck.isFailure) return Result.fail<Address>(pinCodeCheck.getError());

    const pinCodeStr = String(props.pinCode).trim();
    if (!/^\d{6}$/.test(pinCodeStr)) {
      return Result.fail<Address>(new ValidationError('PinCode must be a 6-digit Indian PIN code'));
    }

    const coordCheck = Guard.againstNullOrUndefined(props.coordinates, 'Coordinates');
    if (coordCheck.isFailure) return Result.fail<Address>(coordCheck.getError());

    return Result.ok<Address>(
      new Address({
        label: props.label ? String(props.label).trim() : undefined,
        street: String(props.street).trim(),
        city: String(props.city).trim(),
        state: String(props.state).trim(),
        pinCode: pinCodeStr,
        coordinates: props.coordinates,
      })
    );
  }
}