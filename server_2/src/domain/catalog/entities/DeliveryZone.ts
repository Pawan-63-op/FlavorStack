import { Entity } from '../../shared/Entity';
import { Result } from '../../shared/Result';
import { Guard } from '../../shared/Guard';
import { UniqueEntityId } from '../../shared/UniqueEntityId';
import { ValidationError } from '../../shared/errors/ValidationError';
import { GeoPolygon } from '../value-objects/GeoPolygon.vo';
import { DeliveryFeeMatrix } from '../value-objects/DeliveryFeeMatrix.vo';
import { Money } from '../../shared/Money';

interface DeliveryZoneProps {
  restaurantId: string;
  polygon: GeoPolygon;
  feeMatrix: DeliveryFeeMatrix;
  minOrder: Money;
}

export class DeliveryZone extends Entity<DeliveryZoneProps> {
  private constructor(props: DeliveryZoneProps, id?: UniqueEntityId) {
    super(props, id);
  }

  get restaurantId(): string {
    return this.props.restaurantId;
  }

  get polygon(): GeoPolygon {
    return this.props.polygon;
  }

  get feeMatrix(): DeliveryFeeMatrix {
    return this.props.feeMatrix;
  }

  get minOrder(): Money {
    return this.props.minOrder;
  }

  public static create(
    props: { restaurantId: string; polygon: GeoPolygon; feeMatrix: DeliveryFeeMatrix; minOrder: Money },
    id?: UniqueEntityId
  ): Result<DeliveryZone> {
    const restaurantIdCheck = Guard.againstEmptyString(props.restaurantId, 'RestaurantId');
    if (restaurantIdCheck.isFailure) return Result.fail<DeliveryZone>(restaurantIdCheck.getError());

    if (!(props.polygon instanceof GeoPolygon)) {
      return Result.fail<DeliveryZone>(new ValidationError('Polygon must be a valid GeoPolygon'));
    }

    if (!(props.feeMatrix instanceof DeliveryFeeMatrix)) {
      return Result.fail<DeliveryZone>(new ValidationError('FeeMatrix must be a valid DeliveryFeeMatrix'));
    }

    if (!(props.minOrder instanceof Money)) {
      return Result.fail<DeliveryZone>(new ValidationError('MinOrder must be a valid Money value'));
    }

    return Result.ok<DeliveryZone>(
      new DeliveryZone(
        {
          restaurantId: props.restaurantId,
          polygon: props.polygon,
          feeMatrix: props.feeMatrix,
          minOrder: props.minOrder,
        },
        id
      )
    );
  }

  public updatePolygon(polygon: GeoPolygon): void {
    this.props.polygon = polygon;
  }

  public updateFeeMatrix(feeMatrix: DeliveryFeeMatrix): void {
    this.props.feeMatrix = feeMatrix;
  }

  public updateMinOrder(minOrder: Money): void {
    this.props.minOrder = minOrder;
  }
}
