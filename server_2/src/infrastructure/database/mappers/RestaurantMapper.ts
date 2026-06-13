// Domain <-> persistence mapping for the Restaurant aggregate.
// Restaurant (src/domain/catalog/entities/Restaurant.ts) <-> RestaurantDocument.
//
// toPersistence flattens the aggregate (value objects -> plain fields, GeoJSON for
// geo-indexed shapes). toDomain rebuilds every value object/entity via its create()
// factory (trusted-data: failures are corruption -> DomainError) and rehydrates the
// root through Restaurant.reconstitute, which raises no events. The repository never
// hands a Mongoose document to the domain.
import { Restaurant, RestaurantProps } from '../../../domain/catalog/entities/Restaurant';
import { Category } from '../../../domain/catalog/entities/Category';
import { DeliveryZone } from '../../../domain/catalog/entities/DeliveryZone';
import { Address } from '../../../domain/identity/value-objects/Address.vo';
import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';
import { GeoPolygon } from '../../../domain/catalog/value-objects/GeoPolygon.vo';
import { OpeningHours, WeeklySchedule } from '../../../domain/catalog/value-objects/OpeningHours.vo';
import { DeliveryFeeMatrix, DeliveryFeeTier } from '../../../domain/catalog/value-objects/DeliveryFeeMatrix.vo';
import { CuisineType } from '../../../domain/catalog/value-objects/CuisineType.vo';
import { CatalogVisibility } from '../../../domain/catalog/value-objects/CatalogVisibility.vo';
import { RestaurantStatus } from '../../../domain/catalog/value-objects/RestaurantStatus.vo';
import { Money } from '../../../domain/shared/Money';
import { UniqueEntityId } from '../../../domain/shared/UniqueEntityId';
import {
  RestaurantDocument,
  AddressDocument,
  CategoryDocument,
  DeliveryZoneDocument,
  OpeningHoursDocument,
  MoneyDocument,
  GeoJsonPolygon,
} from '../models/RestaurantModel';
import { rebuildOrThrow } from './rebuildOrThrow';

// ── value-object <-> document helpers ──────────────────────────

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
    'Restaurant address coordinates'
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
    'Restaurant address'
  );
}

function polygonToPersistence(polygon: GeoPolygon): GeoJsonPolygon {
  return polygon.toGeoJson();
}

function polygonToDomain(doc: GeoJsonPolygon, context: string): GeoPolygon {
  // GeoJSON stores [lng, lat]; GeoPoint.create takes (lat, lng).
  const ring = doc.coordinates[0] ?? [];
  const points = ring.map(([lng, lat]) => rebuildOrThrow(GeoPoint.create(lat, lng), context));
  return rebuildOrThrow(GeoPolygon.create(points), context);
}

function feeMatrixToDomain(doc: DeliveryZoneDocument['feeMatrix'], context: string): DeliveryFeeMatrix {
  const tiers: DeliveryFeeTier[] = doc.tiers.map((t) => ({
    maxDistanceMeters: t.maxDistanceMeters,
    fee: moneyToDomain(t.fee, `${context} tier fee`),
  }));
  const freeAboveSubtotal = doc.freeAboveSubtotal
    ? moneyToDomain(doc.freeAboveSubtotal, `${context} freeAboveSubtotal`)
    : undefined;
  return rebuildOrThrow(DeliveryFeeMatrix.create({ tiers, freeAboveSubtotal }), context);
}

function categoryToPersistence(category: Category): CategoryDocument {
  return {
    id: category.id.toString(),
    label: category.label,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
  };
}

function categoryToDomain(doc: CategoryDocument, restaurantId: string): Category {
  return rebuildOrThrow(
    Category.create(
      { restaurantId, label: doc.label, sortOrder: doc.sortOrder, isActive: doc.isActive },
      new UniqueEntityId(doc.id)
    ),
    `Category (${doc.id})`
  );
}

function zoneToPersistence(zone: DeliveryZone): DeliveryZoneDocument {
  return {
    id: zone.id.toString(),
    polygon: polygonToPersistence(zone.polygon),
    feeMatrix: {
      tiers: zone.feeMatrix.tiers.map((t) => ({ maxDistanceMeters: t.maxDistanceMeters, fee: moneyToPersistence(t.fee) })),
      freeAboveSubtotal: zone.feeMatrix.freeAboveSubtotal ? moneyToPersistence(zone.feeMatrix.freeAboveSubtotal) : null,
    },
    minOrder: moneyToPersistence(zone.minOrder),
  };
}

function zoneToDomain(doc: DeliveryZoneDocument, restaurantId: string): DeliveryZone {
  const polygon = polygonToDomain(doc.polygon, `DeliveryZone polygon (${doc.id})`);
  const feeMatrix = feeMatrixToDomain(doc.feeMatrix, `DeliveryZone feeMatrix (${doc.id})`);
  const minOrder = moneyToDomain(doc.minOrder, `DeliveryZone minOrder (${doc.id})`);
  return rebuildOrThrow(
    DeliveryZone.create({ restaurantId, polygon, feeMatrix, minOrder }, new UniqueEntityId(doc.id)),
    `DeliveryZone (${doc.id})`
  );
}

function openingHoursToPersistence(hours: OpeningHours): OpeningHoursDocument {
  return { schedule: hours.schedule, holidays: [...hours.holidays] };
}

function openingHoursToDomain(doc: OpeningHoursDocument): OpeningHours {
  return rebuildOrThrow(
    OpeningHours.create({ schedule: doc.schedule as WeeklySchedule, holidays: doc.holidays }),
    'Restaurant openingHours'
  );
}

// ── aggregate <-> document ─────────────────────────────────────

export class RestaurantMapper {
  static toPersistence(restaurant: Restaurant): RestaurantDocument {
    return {
      _id: restaurant.id.toString(),
      ownerId: restaurant.ownerId,
      name: restaurant.name,
      slug: restaurant.slug,
      description: restaurant.description ?? null,
      cuisineTypes: restaurant.cuisineTypes.map((c) => c.value),
      address: addressToPersistence(restaurant.address),
      location: restaurant.location.toGeoJson(),
      phone: restaurant.phone,
      imageUrl: restaurant.imageUrl ?? null,
      status: restaurant.status.value,
      visibility: restaurant.visibility.value,
      categories: restaurant.categories.map(categoryToPersistence),
      openingHours: restaurant.openingHours ? openingHoursToPersistence(restaurant.openingHours) : null,
      deliveryZones: restaurant.deliveryZones.map(zoneToPersistence),
      version: restaurant.version,
      deletedAt: restaurant.deletedAt,
    };
  }

  static toDomain(doc: RestaurantDocument): Restaurant {
    const restaurantId = doc._id;

    const cuisineTypes = doc.cuisineTypes.map((c) =>
      rebuildOrThrow(CuisineType.create(c as never), `Restaurant cuisineType (${c})`)
    );
    const location = rebuildOrThrow(
      GeoPoint.create(doc.location.coordinates[1], doc.location.coordinates[0]),
      'Restaurant location'
    );
    const status = rebuildOrThrow(RestaurantStatus.create(doc.status), 'Restaurant status');
    const visibility = rebuildOrThrow(CatalogVisibility.create(doc.visibility), 'Restaurant visibility');

    const props: RestaurantProps = {
      ownerId: doc.ownerId,
      name: doc.name,
      slug: doc.slug,
      description: doc.description ?? undefined,
      cuisineTypes,
      address: addressToDomain(doc.address),
      location,
      phone: doc.phone,
      imageUrl: doc.imageUrl ?? undefined,
      status,
      visibility,
      categories: doc.categories.map((c) => categoryToDomain(c, restaurantId)),
      openingHours: doc.openingHours ? openingHoursToDomain(doc.openingHours) : undefined,
      deliveryZones: doc.deliveryZones.map((z) => zoneToDomain(z, restaurantId)),
      version: doc.version,
      deletedAt: doc.deletedAt,
    };

    return Restaurant.reconstitute(props, new UniqueEntityId(restaurantId));
  }
}
