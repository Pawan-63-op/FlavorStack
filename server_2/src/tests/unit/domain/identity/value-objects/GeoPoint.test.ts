import { GeoPoint } from '../../../../../domain/identity/value-objects/GeoPoint.vo';
import { ValidationError } from '../../../../../domain/shared/errors/ValidationError';

describe('GeoPoint Value Object', () => {
  it('should create a valid geo point successfully', () => {
    const geoResult = GeoPoint.create(12.9716, 77.5946);
    expect(geoResult.isSuccess).toBe(true);
    expect(geoResult.getValue().lat).toBe(12.9716);
    expect(geoResult.getValue().lng).toBe(77.5946);
  });

  it('should fail if latitude is out of bounds', () => {
    const geoResult1 = GeoPoint.create(90.1, 0);
    const geoResult2 = GeoPoint.create(-95, 0);
    expect(geoResult1.isFailure).toBe(true);
    expect(geoResult2.isFailure).toBe(true);
    expect(geoResult1.getError()).toBeInstanceOf(ValidationError);
  });

  it('should fail if longitude is out of bounds', () => {
    const geoResult1 = GeoPoint.create(0, 180.5);
    const geoResult2 = GeoPoint.create(0, -190);
    expect(geoResult1.isFailure).toBe(true);
    expect(geoResult2.isFailure).toBe(true);
    expect(geoResult1.getError()).toBeInstanceOf(ValidationError);
  });

  it('should output GeoJSON in [lng, lat] order', () => {
    const geo = GeoPoint.create(12.9716, 77.5946).getValue();
    const geoJson = geo.toGeoJson();

    expect(geoJson).toEqual({
      type: 'Point',
      coordinates: [77.5946, 12.9716]
    });
  });

  it('should calculate Haversine distance between two points', () => {
    const p1 = GeoPoint.create(12.9716, 77.5946).getValue();
    const p2 = GeoPoint.create(13.0827, 80.2707).getValue();

    const distance = p1.distanceTo(p2);
    expect(distance).toBeGreaterThan(280000);
    expect(distance).toBeLessThan(300000);
  });
});
