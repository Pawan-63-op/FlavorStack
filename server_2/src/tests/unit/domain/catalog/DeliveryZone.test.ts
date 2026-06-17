import { DeliveryZone } from '../../../../domain/catalog/entities/DeliveryZone';
import { GeoPolygon } from '../../../../domain/catalog/value-objects/GeoPolygon.vo';
import { GeoPoint } from '../../../../domain/identity/value-objects/GeoPoint.vo';
import { DeliveryFeeMatrix } from '../../../../domain/catalog/value-objects/DeliveryFeeMatrix.vo';
import { Money } from '../../../../domain/shared/Money';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';

function buildPolygon(offset = 0) {
  return GeoPolygon.create([
    GeoPoint.create(0 + offset, 0 + offset).getValue(),
    GeoPoint.create(0 + offset, 1 + offset).getValue(),
    GeoPoint.create(1 + offset, 1 + offset).getValue(),
    GeoPoint.create(1 + offset, 0 + offset).getValue(),
  ]).getValue();
}

function buildFeeMatrix() {
  return DeliveryFeeMatrix.create({
    tiers: [{ maxDistanceMeters: 2000, fee: Money.create(2000).getValue() }],
  }).getValue();
}

describe('DeliveryZone entity', () => {
  const baseProps = () => ({
    restaurantId: 'rest-1',
    polygon: buildPolygon(),
    feeMatrix: buildFeeMatrix(),
    minOrder: Money.create(10000).getValue(),
  });

  it('creates a valid delivery zone', () => {
    const result = DeliveryZone.create(baseProps());
    expect(result.isSuccess).toBe(true);

    const zone = result.getValue();
    expect(zone.restaurantId).toBe('rest-1');
    expect(zone.polygon).toBeInstanceOf(GeoPolygon);
    expect(zone.feeMatrix).toBeInstanceOf(DeliveryFeeMatrix);
    expect(zone.minOrder.amount).toBe(10000);
  });

  it('rejects a missing restaurantId', () => {
    const result = DeliveryZone.create({ ...baseProps(), restaurantId: '' });
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });

  it('updates the polygon', () => {
    const zone = DeliveryZone.create(baseProps()).getValue();
    const newPolygon = buildPolygon(2);

    zone.updatePolygon(newPolygon);
    expect(zone.polygon).toBe(newPolygon);
  });

  it('updates the fee matrix', () => {
    const zone = DeliveryZone.create(baseProps()).getValue();
    const newMatrix = buildFeeMatrix();

    zone.updateFeeMatrix(newMatrix);
    expect(zone.feeMatrix).toBe(newMatrix);
  });

  it('updates the minimum order amount', () => {
    const zone = DeliveryZone.create(baseProps()).getValue();
    const newMin = Money.create(20000).getValue();

    zone.updateMinOrder(newMin);
    expect(zone.minOrder).toBe(newMin);
  });
});
