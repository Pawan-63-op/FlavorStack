import { OrderRequest, OrderRequestProps } from '../../../domain/commerce/entities/OrderRequest';
import { OrderRequestLine } from '../../../domain/commerce/entities/OrderRequestLine';
import { IdempotencyKey } from '../../../domain/commerce/value-objects/IdempotencyKey';
import { PaymentIntent } from '../../../domain/commerce/value-objects/PaymentIntent';
import { Quantity } from '../../../domain/commerce/value-objects/Quantity';
import { RestaurantSnapshot } from '../../../domain/commerce/value-objects/snapshots/RestaurantSnapshot';
import { MenuItemSnapshot } from '../../../domain/commerce/value-objects/snapshots/MenuItemSnapshot';
import { VariantSnapshot } from '../../../domain/commerce/value-objects/snapshots/VariantSnapshot';
import {
  pricingBreakdownToJSON,
  pricingBreakdownFromJSON,
} from '../../../domain/commerce/value-objects/snapshots/snapshot-serialization';
import { PaymentMethod } from '../../../domain/commerce/enums/payment-method.enum';
import { OrderRequestStatus } from '../../../domain/commerce/enums/order-request-status.enum';
import { Money } from '../../../domain/shared/Money';
import { UniqueEntityId } from '../../../domain/shared/UniqueEntityId';
import { Address } from '../../../domain/identity/value-objects/Address.vo';
import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';
import {
  OrderRequestDocument,
  OrderRequestLineDocument,
  AddressDocument,
  MoneyDocument,
} from '../models/OrderRequestModel';
import { rebuildOrThrow } from './rebuildOrThrow';

function moneyToPersistence(money: Money): MoneyDocument {
  return { amount: money.amount, currency: money.currency };
}

function moneyToDomain(doc: MoneyDocument, context: string): Money {
  return rebuildOrThrow(Money.create(doc.amount, doc.currency), context);
}

function addressToPersistence(address: Address): AddressDocument {
  return {
    label: address.label,
    street: address.street,
    city: address.city,
    state: address.state,
    pinCode: address.pinCode,
    coordinates: { lat: address.coordinates.lat, lng: address.coordinates.lng },
  };
}

function addressToDomain(doc: AddressDocument): Address {
  const coordinates = rebuildOrThrow(
    GeoPoint.create(doc.coordinates.lat, doc.coordinates.lng),
    'OrderRequest deliveryAddress coordinates'
  );
  return rebuildOrThrow(
    Address.create({
      label: doc.label,
      street: doc.street,
      city: doc.city,
      state: doc.state,
      pinCode: doc.pinCode,
      coordinates,
    }),
    'OrderRequest deliveryAddress'
  );
}

function lineToPersistence(line: OrderRequestLine): OrderRequestLineDocument {
  return {
    id: line.id.toString(),
    menuItem: line.menuItem.toJSON(),
    selectedOptions: line.selectedOptions.map((option) => option.toJSON()),
    quantity: line.quantity.value,
    lineTotal: moneyToPersistence(line.lineTotal),
  };
}

function lineToDomain(doc: OrderRequestLineDocument): OrderRequestLine {
  const menuItem = rebuildOrThrow(MenuItemSnapshot.fromJSON(doc.menuItem), `OrderRequestLine menuItem (${doc.id})`);
  const selectedOptions = doc.selectedOptions.map((optionJSON, i) =>
    rebuildOrThrow(VariantSnapshot.fromJSON(optionJSON), `OrderRequestLine option ${i} (${doc.id})`)
  );
  const quantity = rebuildOrThrow(Quantity.create(doc.quantity), `OrderRequestLine quantity (${doc.id})`);
  const lineTotal = moneyToDomain(doc.lineTotal, `OrderRequestLine lineTotal (${doc.id})`);

  return rebuildOrThrow(
    OrderRequestLine.create({ menuItem, selectedOptions, quantity, lineTotal }, new UniqueEntityId(doc.id)),
    `OrderRequestLine (${doc.id})`
  );
}

export class OrderRequestMapper {
  static toPersistence(order: OrderRequest): OrderRequestDocument {
    return {
      _id: order.id.toString(),
      customerId: order.customerId,
      idempotencyKey: order.idempotencyKey.value,
      restaurant: order.restaurant.toJSON(),
      lines: order.lines.map(lineToPersistence),
      pricing: pricingBreakdownToJSON(order.pricing),
      deliveryAddress: addressToPersistence(order.deliveryAddress),
      paymentIntent: { method: order.paymentIntent.method },
      status: order.status,
      schemaVersion: order.schemaVersion,
      createdAt: order.createdAt,
    };
  }

  static toDomain(doc: OrderRequestDocument): OrderRequest {
    const idempotencyKey = rebuildOrThrow(
      IdempotencyKey.create(doc.idempotencyKey),
      `OrderRequest idempotencyKey (${doc._id})`
    );
    const restaurant = rebuildOrThrow(
      RestaurantSnapshot.fromJSON(doc.restaurant),
      `OrderRequest restaurant (${doc._id})`
    );
    const pricing = rebuildOrThrow(pricingBreakdownFromJSON(doc.pricing), `OrderRequest pricing (${doc._id})`);
    const paymentIntent = rebuildOrThrow(
      PaymentIntent.create({ method: doc.paymentIntent.method as PaymentMethod }),
      `OrderRequest paymentIntent (${doc._id})`
    );

    const props: OrderRequestProps = {
      customerId: doc.customerId,
      idempotencyKey,
      restaurant,
      lines: doc.lines.map(lineToDomain),
      pricing,
      deliveryAddress: addressToDomain(doc.deliveryAddress),
      paymentIntent,
      status: doc.status as OrderRequestStatus,
      schemaVersion: doc.schemaVersion,
      createdAt: doc.createdAt,
    };

    return OrderRequest.reconstitute(props, new UniqueEntityId(doc._id));
  }
}
