import { VehicleInfo } from '../../../../../domain/identity/value-objects/VehicleInfo.vo';
import { ValidationError } from '../../../../../domain/shared/errors/ValidationError';

describe('VehicleInfo Value Object', () => {
  const validProps = {
    type: 'Bike',
    brand: 'Honda',
    model: 'Activa',
    licensePlate: 'KA-01-EF-1234',
    rcDocumentUrl: 'https://example.com/rc.pdf',
    insuranceUrl: 'https://example.com/ins.pdf'
  };

  it('should create valid vehicle info successfully', () => {
    const res = VehicleInfo.create(validProps);
    expect(res.isSuccess).toBe(true);
    const vehicle = res.getValue();
    expect(vehicle.type).toBe('Bike');
    expect(vehicle.brand).toBe('Honda');
    expect(vehicle.model).toBe('Activa');
    expect(vehicle.licensePlate).toBe('KA-01-EF-1234');
    expect(vehicle.rcDocumentUrl).toBe('https://example.com/rc.pdf');
    expect(vehicle.insuranceUrl).toBe('https://example.com/ins.pdf');
  });

  it('should fail if any required text field is empty', () => {
    const res = VehicleInfo.create({ ...validProps, brand: '' });
    expect(res.isFailure).toBe(true);
    expect(res.getError()).toBeInstanceOf(ValidationError);
  });

  it('should fail if license plate is not valid alphanumeric format', () => {
    const res1 = VehicleInfo.create({ ...validProps, licensePlate: 'KA' }); // too short
    const res2 = VehicleInfo.create({ ...validProps, licensePlate: 'KA-01-EF-1234-5678-9012' }); // too long
    const res3 = VehicleInfo.create({ ...validProps, licensePlate: 'KA-01@EF-1234' }); // invalid char

    expect(res1.isFailure).toBe(true);
    expect(res2.isFailure).toBe(true);
    expect(res3.isFailure).toBe(true);
  });

  it('should fail if document URLs are not valid HTTP/HTTPS URLs', () => {
    const res1 = VehicleInfo.create({ ...validProps, rcDocumentUrl: 'ftp://example.com/rc.pdf' });
    const res2 = VehicleInfo.create({ ...validProps, insuranceUrl: 'just-a-string' });

    expect(res1.isFailure).toBe(true);
    expect(res2.isFailure).toBe(true);
  });

  it('should assert structural equals (same props equal; differing props not)', () => {
    const v1 = VehicleInfo.create(validProps).getValue();
    const v2 = VehicleInfo.create({ ...validProps }).getValue();
    const v3 = VehicleInfo.create({ ...validProps, model: 'Aviator' }).getValue();

    expect(v1.equals(v2)).toBe(true);
    expect(v1.equals(v3)).toBe(false);
  });
});
