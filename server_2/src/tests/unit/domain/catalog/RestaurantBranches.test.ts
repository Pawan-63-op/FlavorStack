// Targeted branch coverage for Restaurant mutator guards that the happy-path tests
// don't exercise: updateProfile field validation + multi-field paths, and the
// delivery-zone update/remove not-found + VO-type guards.
import { Restaurant } from '../../../../domain/catalog/entities/Restaurant';
import { GeoPoint } from '../../../../domain/identity/value-objects/GeoPoint.vo';
import { CUISINE_TYPE } from '../../../../domain/catalog/enums/cuisine-type.enum';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { buildAddress, buildPolygon, buildFeeMatrix, money } from '../../application/catalog/helpers';

function build(): Restaurant {
  const r = Restaurant.create({
    ownerId: 'owner-1',
    name: 'Spice Garden',
    cuisineTypes: [CUISINE_TYPE.NORTH_INDIAN],
    address: buildAddress(),
    location: GeoPoint.create(12.97, 77.59).getValue(),
    phone: '+919876543210',
  }).getValue();
  r.pullDomainEvents();
  return r;
}

describe('Restaurant.updateProfile guards', () => {
  it('rejects an empty name', () => {
    const res = build().updateProfile({ name: '   ' });
    expect(res.getError()).toBeInstanceOf(ValidationError);
  });

  it('rejects an empty phone', () => {
    const res = build().updateProfile({ phone: '' });
    expect(res.getError()).toBeInstanceOf(ValidationError);
  });

  it('rejects a non-array cuisineTypes', () => {
    const res = build().updateProfile({ cuisineTypes: 'NORTH_INDIAN' as unknown as string[] });
    expect(res.getError()).toBeInstanceOf(ValidationError);
  });

  it('rejects an unknown cuisine value', () => {
    const res = build().updateProfile({ cuisineTypes: ['NOT_A_CUISINE'] });
    expect(res.isFailure).toBe(true);
  });

  it('rejects an address that is not an Address VO', () => {
    const res = build().updateProfile({ address: { street: 'x' } as never });
    expect(res.getError()).toBeInstanceOf(ValidationError);
  });

  it('rejects a location that is not a GeoPoint VO', () => {
    const res = build().updateProfile({ location: { lat: 1, lng: 2 } as never });
    expect(res.getError()).toBeInstanceOf(ValidationError);
  });

  it('is a no-op (no event) when no fields change', () => {
    const r = build();
    const res = r.updateProfile({});
    expect(res.isSuccess).toBe(true);
    expect(r.pullDomainEvents()).toHaveLength(0);
  });

  it('updates description + imageUrl together and raises one RestaurantUpdated', () => {
    const r = build();
    const res = r.updateProfile({ description: 'new desc', imageUrl: 'https://img/x.jpg' });
    expect(res.isSuccess).toBe(true);
    const events = r.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0].eventName).toBe('RestaurantUpdated');
  });
});

describe('Restaurant delivery-zone guards', () => {
  function withZone(): { restaurant: Restaurant; zoneId: string } {
    const restaurant = build();
    const zone = restaurant
      .addZone({ polygon: buildPolygon(), feeMatrix: buildFeeMatrix(), minOrder: money(10000) })
      .getValue();
    restaurant.pullDomainEvents();
    return { restaurant, zoneId: zone.id.toString() };
  }

  it('updateZone fails NotFound for an unknown zone', () => {
    const res = build().updateZone('missing', { minOrder: money(5000) });
    expect(res.getError()).toBeInstanceOf(NotFoundError);
  });

  it('updateZone rejects a non-VO polygon / feeMatrix / minOrder', () => {
    const { restaurant, zoneId } = withZone();
    expect(restaurant.updateZone(zoneId, { polygon: {} as never }).getError()).toBeInstanceOf(ValidationError);
    expect(restaurant.updateZone(zoneId, { feeMatrix: {} as never }).getError()).toBeInstanceOf(ValidationError);
    expect(restaurant.updateZone(zoneId, { minOrder: {} as never }).getError()).toBeInstanceOf(ValidationError);
  });

  it('updateZone updates the minimum order and raises DeliveryZoneChanged(UPDATED)', () => {
    const { restaurant, zoneId } = withZone();
    const res = restaurant.updateZone(zoneId, { minOrder: money(20000) });
    expect(res.isSuccess).toBe(true);
    const events = restaurant.pullDomainEvents();
    expect(events[0].eventName).toBe('DeliveryZoneChanged');
  });

  it('removeZone fails NotFound for an unknown zone', () => {
    const res = build().removeZone('missing');
    expect(res.getError()).toBeInstanceOf(NotFoundError);
  });

  it('removeZone drops the zone and raises DeliveryZoneChanged(REMOVED)', () => {
    const { restaurant, zoneId } = withZone();
    const res = restaurant.removeZone(zoneId);
    expect(res.isSuccess).toBe(true);
    expect(restaurant.deliveryZones).toHaveLength(0);
  });
});
