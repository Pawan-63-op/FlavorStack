import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ValidationError } from '../../../domain/shared/errors/ValidationError';
import { Money } from '../../../domain/shared/Money';
import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';
import { GeoPolygon } from '../../../domain/catalog/value-objects/GeoPolygon.vo';
import { DeliveryFeeMatrix, DeliveryFeeTier } from '../../../domain/catalog/value-objects/DeliveryFeeMatrix.vo';
import { IRestaurantRepository } from '../../../domain/catalog/repositories/IRestaurantRepository';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IOutboxStore } from '../../shared/outbox/IOutboxStore';
import { IEventBus } from '../../shared/events/IEventBus';
import { DELIVERY_ZONE_ACTION, ManageDeliveryZoneDto } from '../dtos/ManageDeliveryZoneDto';
import { RestaurantResponse } from '../responses/RestaurantResponse';
import { toRestaurantResponse } from '../responses/mappers';
import { assertRestaurantOwnership } from './shared/ownership';

/** Owner (or super-admin) write: create/update/remove a GeoJSON delivery zone. */
export class ManageDeliveryZone {
  constructor(
    private restaurantRepo: IRestaurantRepository,
    private unitOfWork: IUnitOfWork,
    private outboxStore: IOutboxStore,
    private eventBus: IEventBus
  ) {}

  async execute(dto: ManageDeliveryZoneDto): Promise<Result<RestaurantResponse>> {
    const restaurant = await this.restaurantRepo.findById(dto.restaurantId);
    if (!restaurant) return Result.fail(new NotFoundError('restaurant_not_found'));

    const ownership = assertRestaurantOwnership(restaurant, dto);
    if (ownership.isFailure) return Result.fail(ownership.getError());

    if (dto.action === DELIVERY_ZONE_ACTION.ADD) {
      if (!dto.polygon || !dto.feeMatrix || !dto.minOrder) {
        return Result.fail(new ValidationError('polygon, feeMatrix and minOrder are required to add a delivery zone'));
      }

      const polygonResult = this.buildPolygon(dto.polygon);
      if (polygonResult.isFailure) return Result.fail(polygonResult.getError());

      const feeMatrixResult = this.buildFeeMatrix(dto.feeMatrix);
      if (feeMatrixResult.isFailure) return Result.fail(feeMatrixResult.getError());

      const minOrderResult = Money.create(dto.minOrder.amount, dto.minOrder.currency);
      if (minOrderResult.isFailure) return Result.fail(minOrderResult.getError());

      const addResult = restaurant.addZone({
        polygon: polygonResult.getValue(),
        feeMatrix: feeMatrixResult.getValue(),
        minOrder: minOrderResult.getValue(),
      });
      if (addResult.isFailure) return Result.fail(addResult.getError());
    } else if (dto.action === DELIVERY_ZONE_ACTION.UPDATE) {
      if (!dto.zoneId) return Result.fail(new ValidationError('zoneId is required to update a delivery zone'));

      const changes: { polygon?: GeoPolygon; feeMatrix?: DeliveryFeeMatrix; minOrder?: Money } = {};

      if (dto.polygon !== undefined) {
        const polygonResult = this.buildPolygon(dto.polygon);
        if (polygonResult.isFailure) return Result.fail(polygonResult.getError());
        changes.polygon = polygonResult.getValue();
      }

      if (dto.feeMatrix !== undefined) {
        const feeMatrixResult = this.buildFeeMatrix(dto.feeMatrix);
        if (feeMatrixResult.isFailure) return Result.fail(feeMatrixResult.getError());
        changes.feeMatrix = feeMatrixResult.getValue();
      }

      if (dto.minOrder !== undefined) {
        const minOrderResult = Money.create(dto.minOrder.amount, dto.minOrder.currency);
        if (minOrderResult.isFailure) return Result.fail(minOrderResult.getError());
        changes.minOrder = minOrderResult.getValue();
      }

      const updateResult = restaurant.updateZone(dto.zoneId, changes);
      if (updateResult.isFailure) return Result.fail(updateResult.getError());
    } else if (dto.action === DELIVERY_ZONE_ACTION.REMOVE) {
      if (!dto.zoneId) return Result.fail(new ValidationError('zoneId is required to remove a delivery zone'));

      const removeResult = restaurant.removeZone(dto.zoneId);
      if (removeResult.isFailure) return Result.fail(removeResult.getError());
    } else {
      return Result.fail(new ValidationError('Invalid delivery zone action'));
    }

    const events = restaurant.pullDomainEvents();

    await this.unitOfWork.runInTransaction(async (ctx) => {
      await this.restaurantRepo.update(restaurant);
      if (events.length > 0) {
        await this.outboxStore.append(events, ctx);
      }
    });

    await this.eventBus.publishAll(events);

    return Result.ok(toRestaurantResponse(restaurant));
  }

  private buildPolygon(points: { lat: number; lng: number }[]): Result<GeoPolygon> {
    const geoPoints: GeoPoint[] = [];
    for (const point of points) {
      const geoPointResult = GeoPoint.create(point.lat, point.lng);
      if (geoPointResult.isFailure) return Result.fail<GeoPolygon>(geoPointResult.getError());
      geoPoints.push(geoPointResult.getValue());
    }
    return GeoPolygon.create(geoPoints);
  }

  private buildFeeMatrix(input: {
    tiers: { maxDistanceMeters: number; fee: { amount: number; currency?: string } }[];
    freeAboveSubtotal?: { amount: number; currency?: string };
  }): Result<DeliveryFeeMatrix> {
    const tiers: DeliveryFeeTier[] = [];
    for (const tier of input.tiers) {
      const feeResult = Money.create(tier.fee.amount, tier.fee.currency);
      if (feeResult.isFailure) return Result.fail<DeliveryFeeMatrix>(feeResult.getError());
      tiers.push({ maxDistanceMeters: tier.maxDistanceMeters, fee: feeResult.getValue() });
    }

    let freeAboveSubtotal: Money | undefined;
    if (input.freeAboveSubtotal !== undefined) {
      const freeResult = Money.create(input.freeAboveSubtotal.amount, input.freeAboveSubtotal.currency);
      if (freeResult.isFailure) return Result.fail<DeliveryFeeMatrix>(freeResult.getError());
      freeAboveSubtotal = freeResult.getValue();
    }

    return DeliveryFeeMatrix.create({ tiers, freeAboveSubtotal });
  }
}
