import { Address } from '../../../../../domain/identity/value-objects/Address.vo';
import { GeoPoint } from '../../../../../domain/identity/value-objects/GeoPoint.vo';
import { ValidationError } from '../../../../../domain/shared/errors/ValidationError';

describe('Address Value Object', () => {
  const coords = GeoPoint.create(12.9716, 77.5946).getValue();

  it('should create a valid address successfully', () => {
    const addressResult = Address.create({
      label: 'Home',
      street: '100 Feet Road, Indiranagar',
      city: 'Bangalore',
      state: 'Karnataka',
      pinCode: '560038',
      coordinates: coords
    });

    expect(addressResult.isSuccess).toBe(true);
    const addr = addressResult.getValue();
    expect(addr.label).toBe('Home');
    expect(addr.street).toBe('100 Feet Road, Indiranagar');
    expect(addr.city).toBe('Bangalore');
    expect(addr.state).toBe('Karnataka');
    expect(addr.pinCode).toBe('560038');
    expect(addr.coordinates.equals(coords)).toBe(true);
    expect(addr.toString()).toBe('[Home] 100 Feet Road, Indiranagar, Bangalore, Karnataka - 560038');
  });

  it('should create without optional label', () => {
    const addressResult = Address.create({
      street: '100 Feet Road, Indiranagar',
      city: 'Bangalore',
      state: 'Karnataka',
      pinCode: '560038',
      coordinates: coords
    });

    expect(addressResult.isSuccess).toBe(true);
    expect(addressResult.getValue().label).toBeUndefined();
    expect(addressResult.getValue().toString()).toBe('100 Feet Road, Indiranagar, Bangalore, Karnataka - 560038');
  });

  it('should fail if street, city, or state is empty', () => {
    const res = Address.create({
      street: '',
      city: 'Bangalore',
      state: 'Karnataka',
      pinCode: '560038',
      coordinates: coords
    });
    expect(res.isFailure).toBe(true);
    expect(res.getError()).toBeInstanceOf(ValidationError);
  });

  it('should fail if pinCode is not 6-digit Indian PIN code', () => {
    const res1 = Address.create({
      street: '100 Feet Road',
      city: 'Bangalore',
      state: 'Karnataka',
      pinCode: '56003',
      coordinates: coords
    });

    const res2 = Address.create({
      street: '100 Feet Road',
      city: 'Bangalore',
      state: 'Karnataka',
      pinCode: '5600389',
      coordinates: coords
    });

    const res3 = Address.create({
      street: '100 Feet Road',
      city: 'Bangalore',
      state: 'Karnataka',
      pinCode: 'ABCDEF',
      coordinates: coords
    });

    expect(res1.isFailure).toBe(true);
    expect(res2.isFailure).toBe(true);
    expect(res3.isFailure).toBe(true);
  });

  it('should fail if coordinates are missing', () => {
    const res = Address.create({
      street: '100 Feet Road',
      city: 'Bangalore',
      state: 'Karnataka',
      pinCode: '560038',
      coordinates: null as any
    });
    expect(res.isFailure).toBe(true);
  });
});
