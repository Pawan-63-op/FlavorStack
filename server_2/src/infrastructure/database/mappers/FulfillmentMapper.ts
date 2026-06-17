// Maps between the Fulfillment aggregate and FulfillmentModel documents (fulfillment_module.md §8).
//
// toPersistence flattens the aggregate's VOs to plain documents. toDomain rebuilds every VO via its
// create() factory (trusted data: a failure means stored corruption -> DomainError via rebuildOrThrow)
// and rehydrates the root through Fulfillment.reconstitute, which raises no events.
import { Fulfillment, FulfillmentProps } from '../../../domain/fulfillment/entities/Fulfillment';
import { FulfillmentLine, FulfillmentLineOption } from '../../../domain/fulfillment/value-objects/FulfillmentLine';
import { DeliveryAddress } from '../../../domain/fulfillment/value-objects/DeliveryAddress';
import { CancellationInfo } from '../../../domain/fulfillment/value-objects/CancellationInfo';
import { CancelledByValue } from '../../../domain/fulfillment/enums/cancelled-by.enum';
import { FailureReasonValue } from '../../../domain/fulfillment/enums/failure-reason.enum';
import { FulfillmentStatus } from '../../../domain/fulfillment/value-objects/FulfillmentStatus';
import { DeliveryStatus } from '../../../domain/fulfillment/value-objects/DeliveryStatus';
import { RiderAssignment } from '../../../domain/fulfillment/entities/RiderAssignment';
import { RiderAssignmentStatus } from '../../../domain/fulfillment/value-objects/RiderAssignmentStatus';
import { FulfillmentStatusValue } from '../../../domain/fulfillment/enums/fulfillment-status.enum';
import { DELIVERY_STATUS, DeliveryStatusValue } from '../../../domain/fulfillment/enums/delivery-status.enum';
import { RiderAssignmentStatusValue } from '../../../domain/fulfillment/enums/rider-assignment-status.enum';
import { Money } from '../../../domain/shared/Money';
import { UniqueEntityId } from '../../../domain/shared/UniqueEntityId';
import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';
import {
  FulfillmentDocument,
  FulfillmentLineDocument,
  FulfillmentDeliveryAddressDocument,
  RiderAssignmentDocument,
  CancellationInfoDocument,
  MoneyDocument,
} from '../models/FulfillmentModel';
import { rebuildOrThrow } from './rebuildOrThrow';

function moneyToPersistence(money: Money): MoneyDocument {
  return { amount: money.amount, currency: money.currency };
}

function moneyToDomain(doc: MoneyDocument, context: string): Money {
  return rebuildOrThrow(Money.create(doc.amount, doc.currency), context);
}

function lineToPersistence(line: FulfillmentLine): FulfillmentLineDocument {
  return {
    menuItemId: line.menuItemId,
    name: line.name,
    quantity: line.quantity,
    selectedOptions: line.selectedOptions.map((option) => ({
      optionId: option.optionId,
      label: option.label,
      priceDelta: moneyToPersistence(option.priceDelta),
    })),
    lineTotal: moneyToPersistence(line.lineTotal),
  };
}

function lineToDomain(doc: FulfillmentLineDocument): FulfillmentLine {
  const selectedOptions: FulfillmentLineOption[] = doc.selectedOptions.map((option, i) => ({
    optionId: option.optionId,
    label: option.label,
    priceDelta: moneyToDomain(option.priceDelta, `FulfillmentLine option ${i} priceDelta (${doc.menuItemId})`),
  }));

  return rebuildOrThrow(
    FulfillmentLine.create({
      menuItemId: doc.menuItemId,
      name: doc.name,
      quantity: doc.quantity,
      selectedOptions,
      lineTotal: moneyToDomain(doc.lineTotal, `FulfillmentLine lineTotal (${doc.menuItemId})`),
    }),
    `FulfillmentLine (${doc.menuItemId})`
  );
}

function addressToPersistence(address: DeliveryAddress): FulfillmentDeliveryAddressDocument {
  return {
    label: address.label,
    street: address.street,
    city: address.city,
    state: address.state,
    pinCode: address.pinCode,
    coordinates: { lat: address.coordinates.lat, lng: address.coordinates.lng },
  };
}

function addressToDomain(doc: FulfillmentDeliveryAddressDocument): DeliveryAddress {
  const coordinates = rebuildOrThrow(
    GeoPoint.create(doc.coordinates.lat, doc.coordinates.lng),
    'Fulfillment deliveryAddress coordinates'
  );
  return rebuildOrThrow(
    DeliveryAddress.create({
      label: doc.label,
      street: doc.street,
      city: doc.city,
      state: doc.state,
      pinCode: doc.pinCode,
      coordinates,
    }),
    'Fulfillment deliveryAddress'
  );
}

function assignmentToPersistence(assignment: RiderAssignment): RiderAssignmentDocument {
  return {
    id: assignment.id.toString(),
    riderId: assignment.riderId,
    status: assignment.status.value,
    attempt: assignment.attempt,
    offeredAt: assignment.offeredAt,
    acceptedAt: assignment.acceptedAt,
    respondedAt: assignment.respondedAt,
    expiresAt: assignment.expiresAt,
  };
}

function assignmentToDomain(doc: RiderAssignmentDocument): RiderAssignment {
  const status = rebuildOrThrow(
    RiderAssignmentStatus.create(doc.status as RiderAssignmentStatusValue),
    `RiderAssignment status (${doc.id})`
  );
  return RiderAssignment.reconstitute(
    {
      riderId: doc.riderId,
      status,
      attempt: doc.attempt,
      offeredAt: doc.offeredAt,
      acceptedAt: doc.acceptedAt ?? null,
      respondedAt: doc.respondedAt ?? null,
      expiresAt: doc.expiresAt,
    },
    new UniqueEntityId(doc.id)
  );
}

function cancellationToPersistence(cancellation: CancellationInfo): CancellationInfoDocument {
  return {
    cancelledBy: cancellation.cancelledBy,
    reason: cancellation.reason,
    at: cancellation.at,
  };
}

function cancellationToDomain(doc: CancellationInfoDocument): CancellationInfo {
  return rebuildOrThrow(
    CancellationInfo.create({
      cancelledBy: doc.cancelledBy as CancelledByValue,
      reason: doc.reason,
      at: doc.at,
    }),
    'Fulfillment cancellation'
  );
}

export class FulfillmentMapper {
  static toPersistence(fulfillment: Fulfillment): FulfillmentDocument {
    return {
      _id: fulfillment.id.toString(),
      orderRequestId: fulfillment.orderRequestId,
      customerId: fulfillment.customerId,
      restaurantId: fulfillment.restaurantId,
      lines: fulfillment.lines.map(lineToPersistence),
      deliveryAddress: addressToPersistence(fulfillment.deliveryAddress),
      pricingTotal: moneyToPersistence(fulfillment.pricingTotal),
      fulfillmentStatus: fulfillment.fulfillmentStatus.value,
      deliveryStatus: fulfillment.deliveryStatus.value,
      currentAssignment: fulfillment.currentAssignment
        ? assignmentToPersistence(fulfillment.currentAssignment)
        : null,
      assignmentHistory: fulfillment.assignmentHistory.map(assignmentToPersistence),
      cancellation: fulfillment.cancellation ? cancellationToPersistence(fulfillment.cancellation) : null,
      failureReason: fulfillment.failureReason,
      prepEstimateMinutes: fulfillment.prepEstimateMinutes,
      createdAt: fulfillment.createdAt,
      updatedAt: fulfillment.updatedAt,
      readyAt: fulfillment.readyAt,
      pickedUpAt: fulfillment.pickedUpAt,
      deliveredAt: fulfillment.deliveredAt,
      version: fulfillment.version,
    };
  }

  static toDomain(doc: FulfillmentDocument): Fulfillment {
    const fulfillmentStatus = rebuildOrThrow(
      FulfillmentStatus.create(doc.fulfillmentStatus as FulfillmentStatusValue),
      `Fulfillment status (${doc._id})`
    );

    const deliveryStatus = rebuildOrThrow(
      DeliveryStatus.create((doc.deliveryStatus ?? DELIVERY_STATUS.UNASSIGNED) as DeliveryStatusValue),
      `Fulfillment delivery status (${doc._id})`
    );

    const props: FulfillmentProps = {
      orderRequestId: doc.orderRequestId,
      customerId: doc.customerId,
      restaurantId: doc.restaurantId,
      lines: doc.lines.map(lineToDomain),
      deliveryAddress: addressToDomain(doc.deliveryAddress),
      pricingTotal: moneyToDomain(doc.pricingTotal, `Fulfillment pricingTotal (${doc._id})`),
      fulfillmentStatus,
      deliveryStatus,
      currentAssignment: doc.currentAssignment ? assignmentToDomain(doc.currentAssignment) : null,
      assignmentHistory: (doc.assignmentHistory ?? []).map(assignmentToDomain),
      cancellation: doc.cancellation ? cancellationToDomain(doc.cancellation) : null,
      failureReason: (doc.failureReason ?? null) as FailureReasonValue | null,
      prepEstimateMinutes: doc.prepEstimateMinutes,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      readyAt: doc.readyAt,
      pickedUpAt: doc.pickedUpAt,
      deliveredAt: doc.deliveredAt,
      version: doc.version,
    };

    return Fulfillment.reconstitute(props, new UniqueEntityId(doc._id));
  }
}
