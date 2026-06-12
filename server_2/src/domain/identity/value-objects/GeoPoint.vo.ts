import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { Guard } from '../../shared/Guard';
import { ValidationError } from '../../shared/errors/ValidationError';

interface GeoPointProps {
  lat: number;
  lng: number;
}

export class GeoPoint extends ValueObject<GeoPointProps> {
  private constructor(props: GeoPointProps) {
    super(props);
  }

  get lat(): number {
    return this.props.lat;
  }

  get lng(): number {
    return this.props.lng;
  }

  public static create(lat: number, lng: number): Result<GeoPoint> {
    if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
      return Result.fail<GeoPoint>(new ValidationError('Latitude and longitude must be valid numbers'));
    }

    const latRangeCheck = Guard.inRange(lat, -90, 90, 'Latitude');
    if (latRangeCheck.isFailure) {
      return Result.fail<GeoPoint>(latRangeCheck.getError());
    }

    const lngRangeCheck = Guard.inRange(lng, -180, 180, 'Longitude');
    if (lngRangeCheck.isFailure) {
      return Result.fail<GeoPoint>(lngRangeCheck.getError());
    }

    return Result.ok<GeoPoint>(new GeoPoint({ lat, lng }));
  }

  public distanceTo(other: GeoPoint): number {
    const R = 6371e3; // Earth radius in metres
    const phi1 = (this.props.lat * Math.PI) / 180;
    const phi2 = (other.lat * Math.PI) / 180;
    const deltaPhi = ((other.lat - this.props.lat) * Math.PI) / 180;
    const deltaLambda = ((other.lng - this.props.lng) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in metres
  }

  public toGeoJson(): { type: 'Point'; coordinates: [number, number] } {
    return {
      type: 'Point',
      coordinates: [this.props.lng, this.props.lat],
    };
  }
}
