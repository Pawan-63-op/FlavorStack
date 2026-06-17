import { GeoPolygon } from '../../../../../domain/catalog/value-objects/GeoPolygon.vo';
import { GeoPoint } from '../../../../../domain/identity/value-objects/GeoPoint.vo';
import { ValidationError } from '../../../../../domain/shared/errors/ValidationError';

const p = (lat: number, lng: number) => GeoPoint.create(lat, lng).getValue();

describe('GeoPolygon Value Object', () => {
  it('should create a valid closed-ring polygon', () => {
    const ring = [p(0, 0), p(0, 1), p(1, 1), p(1, 0), p(0, 0)];
    const result = GeoPolygon.create(ring);

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().points).toHaveLength(5);
  });

  it('should auto-close an open ring', () => {
    const ring = [p(0, 0), p(0, 1), p(1, 1), p(1, 0)];
    const result = GeoPolygon.create(ring);

    expect(result.isSuccess).toBe(true);
    const points = result.getValue().points;
    expect(points).toHaveLength(5);
    expect(points[points.length - 1].equals(points[0])).toBe(true);
  });

  it('should fail with fewer than 3 distinct points', () => {
    const ring = [p(0, 0), p(0, 1), p(0, 0)];
    const result = GeoPolygon.create(ring);

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });

  it('should fail when points are missing or not an array', () => {
    const result = GeoPolygon.create(null as any);
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });

  it('should determine if a point is contained within the polygon (ray-casting)', () => {
    const ring = [p(0, 0), p(0, 10), p(10, 10), p(10, 0), p(0, 0)];
    const polygon = GeoPolygon.create(ring).getValue();

    expect(polygon.contains(p(5, 5))).toBe(true);
    expect(polygon.contains(p(15, 15))).toBe(false);
    expect(polygon.contains(p(-1, 5))).toBe(false);
  });

  it('should serialize to GeoJSON Polygon with [lng, lat] coordinate order', () => {
    const ring = [p(0, 0), p(0, 1), p(1, 1), p(1, 0), p(0, 0)];
    const polygon = GeoPolygon.create(ring).getValue();

    const geoJson = polygon.toGeoJson();
    expect(geoJson.type).toBe('Polygon');
    expect(geoJson.coordinates[0]).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ]);
  });
});
