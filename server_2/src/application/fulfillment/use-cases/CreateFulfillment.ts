import { Result } from '../../../domain/shared/Result';
import { Money } from '../../../domain/shared/Money';
import { ValidationError } from '../../../domain/shared/errors/ValidationError';
import { ConflictError } from '../../../domain/shared/errors/ConflictError';
import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';
import { IFulfillmentRepository } from '../../../domain/fulfillment/repositories/IFulfillmentRepository';
import { Fulfillment } from '../../../domain/fulfillment/entities/Fulfillment';
import { FulfillmentLine, FulfillmentLineOption } from '../../../domain/fulfillment/value-objects/FulfillmentLine';
import { DeliveryAddress } from '../../../domain/fulfillment/value-objects/DeliveryAddress';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IEventBus } from '../../shared/events/IEventBus';
import { CreateFulfillmentDto, CreateFulfillmentMoneyDto } from '../dtos/CreateFulfillmentDto';
import { FulfillmentResponse, toFulfillmentResponse } from '../responses/FulfillmentResponse';

export class CreateFulfillment {
  constructor(
    private readonly fulfillmentRepo: IFulfillmentRepository,
    private readonly unitOfWork: IUnitOfWork,
    private readonly eventBus: IEventBus
  ) {}

  async execute(dto: CreateFulfillmentDto): Promise<Result<FulfillmentResponse>> {
    const existing = await this.fulfillmentRepo.findByOrderRequestId(dto.orderRequestId);
    if (existing) {
      return Result.ok<FulfillmentResponse>(toFulfillmentResponse(existing));
    }

    const linesResult = this.buildLines(dto);
    if (linesResult.isFailure) return Result.fail<FulfillmentResponse>(linesResult.getError());

    const addressResult = this.buildAddress(dto);
    if (addressResult.isFailure) return Result.fail<FulfillmentResponse>(addressResult.getError());

    const totalResult = this.buildMoney(dto.total);
    if (totalResult.isFailure) return Result.fail<FulfillmentResponse>(totalResult.getError());

    const fulfillmentResult = Fulfillment.createFromOrderRequested({
      orderRequestId: dto.orderRequestId,
      customerId: dto.customerId,
      restaurantId: dto.restaurantId,
      lines: linesResult.getValue(),
      deliveryAddress: addressResult.getValue(),
      pricingTotal: totalResult.getValue(),
    });
    if (fulfillmentResult.isFailure) return Result.fail<FulfillmentResponse>(fulfillmentResult.getError());
    const fulfillment = fulfillmentResult.getValue();

    const events = fulfillment.pullDomainEvents();

    try {
      await this.unitOfWork.runInTransaction(async () => {
        await this.fulfillmentRepo.save(fulfillment);
      });
    } catch (err) {
      if (err instanceof ConflictError) {
        const winner = await this.fulfillmentRepo.findByOrderRequestId(dto.orderRequestId);
        if (winner) return Result.ok<FulfillmentResponse>(toFulfillmentResponse(winner));
      }
      throw err;
    }

    await this.eventBus.publishAll(events);

    return Result.ok<FulfillmentResponse>(toFulfillmentResponse(fulfillment));
  }

  private buildLines(dto: CreateFulfillmentDto): Result<FulfillmentLine[]> {
    if (!Array.isArray(dto.lines) || dto.lines.length === 0) {
      return Result.fail<FulfillmentLine[]>(new ValidationError('OrderRequested must contain at least one line'));
    }

    const lines: FulfillmentLine[] = [];
    for (const lineDto of dto.lines) {
      const lineTotalResult = this.buildMoney(lineDto.lineTotal);
      if (lineTotalResult.isFailure) return Result.fail<FulfillmentLine[]>(lineTotalResult.getError());

      const options: FulfillmentLineOption[] = [];
      for (const optionDto of lineDto.selectedOptions ?? []) {
        const priceDeltaResult = this.buildMoney(optionDto.priceDelta);
        if (priceDeltaResult.isFailure) return Result.fail<FulfillmentLine[]>(priceDeltaResult.getError());
        options.push({
          optionId: optionDto.optionId,
          label: optionDto.label,
          priceDelta: priceDeltaResult.getValue(),
        });
      }

      const lineResult = FulfillmentLine.create({
        menuItemId: lineDto.menuItemId,
        name: lineDto.name,
        quantity: lineDto.quantity,
        selectedOptions: options,
        lineTotal: lineTotalResult.getValue(),
      });
      if (lineResult.isFailure) return Result.fail<FulfillmentLine[]>(lineResult.getError());
      lines.push(lineResult.getValue());
    }

    return Result.ok<FulfillmentLine[]>(lines);
  }

  private buildAddress(dto: CreateFulfillmentDto): Result<DeliveryAddress> {
    const coords = dto.deliveryAddress.coordinates;
    const pointResult = GeoPoint.create(coords.lat, coords.lng);
    if (pointResult.isFailure) return Result.fail<DeliveryAddress>(pointResult.getError());

    return DeliveryAddress.create({
      label: dto.deliveryAddress.label,
      street: dto.deliveryAddress.street,
      city: dto.deliveryAddress.city,
      state: dto.deliveryAddress.state,
      pinCode: dto.deliveryAddress.pinCode,
      coordinates: pointResult.getValue(),
    });
  }

  private buildMoney(money: CreateFulfillmentMoneyDto): Result<Money> {
    if (!money || typeof money.amount !== 'number') {
      return Result.fail<Money>(new ValidationError('Money must carry a numeric amount'));
    }
    return Money.create(money.amount, money.currency);
  }
}
