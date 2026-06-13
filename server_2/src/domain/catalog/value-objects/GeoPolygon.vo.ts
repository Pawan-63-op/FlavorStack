import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { ValidationError } from '../../shared/errors/ValidationError';
import { GeoPoint } from '../../identity/value-objects/GeoPoint.vo';

interface GeoPolygonProps {
  points: GeoPoint[];
}

export class GeoPolygon extends ValueObject<GeoPolygonProps> {
  private constructor(props: GeoPolygonProps) {
    super(props);
  }

  get points(): GeoPoint[] {
    return this.props.points;
  }

  public static create(points: GeoPoint[]): Result<GeoPolygon> {
    if (!Array.isArray(points)) {
      return Result.fail<GeoPolygon>(new ValidationError('Polygon points must be an array of GeoPoint'));
    }

    const ring = [...points];
    if (ring.length > 0 && !ring[0].equals(ring[ring.length - 1])) {
      ring.push(ring[0]);
    }

    // A closed ring needs at least 3 distinct vertices (4 points including the repeated closing point)
    if (ring.length < 4) {
      return Result.fail<GeoPolygon>(new ValidationError('Polygon must have at least 3 distinct points'));
    }

    return Result.ok<GeoPolygon>(new GeoPolygon({ points: ring }));
  }

  /** Ray-casting point-in-polygon test using lat/lng as planar coordinates. */
  public contains(point: GeoPoint): boolean {
    const ring = this.props.points;
    let inside = false;

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i].lng;
      const yi = ring[i].lat;
      const xj = ring[j].lng;
      const yj = ring[j].lat;

      const intersects =
        yi > point.lat !== yj > point.lat &&
        point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;

      if (intersects) {
        inside = !inside;
      }
    }

    return inside;
  }

  public toGeoJson(): { type: 'Polygon'; coordinates: [number, number][][] } {
    return {
      type: 'Polygon',
      coordinates: [this.props.points.map((p) => [p.lng, p.lat] as [number, number])],
    };
  }
}
