import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { Guard } from '../../shared/Guard';
import { ValidationError } from '../../shared/errors/ValidationError';

interface VehicleInfoProps {
  type: string;
  brand: string;
  model: string;
  licensePlate: string;
  rcDocumentUrl: string;
  insuranceUrl: string;
}

export class VehicleInfo extends ValueObject<VehicleInfoProps> {
  private constructor(props: VehicleInfoProps) {
    super(props);
  }

  get type(): string {
    return this.props.type;
  }

  get brand(): string {
    return this.props.brand;
  }

  get model(): string {
    return this.props.model;
  }

  get licensePlate(): string {
    return this.props.licensePlate;
  }

  get rcDocumentUrl(): string {
    return this.props.rcDocumentUrl;
  }

  get insuranceUrl(): string {
    return this.props.insuranceUrl;
  }

  public static create(props: {
    type: string;
    brand: string;
    model: string;
    licensePlate: string;
    rcDocumentUrl: string;
    insuranceUrl: string;
  }): Result<VehicleInfo> {
    const typeCheck = Guard.againstEmptyString(props.type, 'Vehicle Type');
    if (typeCheck.isFailure) return Result.fail<VehicleInfo>(typeCheck.getError());

    const brandCheck = Guard.againstEmptyString(props.brand, 'Vehicle Brand');
    if (brandCheck.isFailure) return Result.fail<VehicleInfo>(brandCheck.getError());

    const modelCheck = Guard.againstEmptyString(props.model, 'Vehicle Model');
    if (modelCheck.isFailure) return Result.fail<VehicleInfo>(modelCheck.getError());

    const licenseCheck = Guard.againstEmptyString(props.licensePlate, 'License Plate');
    if (licenseCheck.isFailure) return Result.fail<VehicleInfo>(licenseCheck.getError());

    const normalizedPlate = String(props.licensePlate).trim().toUpperCase();
    if (!/^[A-Z0-9\-\s]{3,20}$/.test(normalizedPlate)) {
      return Result.fail<VehicleInfo>(
        new ValidationError('License plate must be alphanumeric (3-20 characters)')
      );
    }

    const rcCheck = Guard.againstEmptyString(props.rcDocumentUrl, 'RC Document URL');
    if (rcCheck.isFailure) return Result.fail<VehicleInfo>(rcCheck.getError());

    const insCheck = Guard.againstEmptyString(props.insuranceUrl, 'Insurance URL');
    if (insCheck.isFailure) return Result.fail<VehicleInfo>(insCheck.getError());

    const urlRegex = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
    if (!urlRegex.test(props.rcDocumentUrl)) {
      return Result.fail<VehicleInfo>(new ValidationError('RC Document URL must be a valid HTTP/HTTPS URL'));
    }

    if (!urlRegex.test(props.insuranceUrl)) {
      return Result.fail<VehicleInfo>(new ValidationError('Insurance URL must be a valid HTTP/HTTPS URL'));
    }

    return Result.ok<VehicleInfo>(
      new VehicleInfo({
        type: String(props.type).trim(),
        brand: String(props.brand).trim(),
        model: String(props.model).trim(),
        licensePlate: normalizedPlate,
        rcDocumentUrl: String(props.rcDocumentUrl).trim(),
        insuranceUrl: String(props.insuranceUrl).trim(),
      })
    );
  }
}
