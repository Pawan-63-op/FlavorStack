// Builders for fully-populated catalog aggregates used by the Phase 8 persistence
// integration tests. Each helper returns a domain aggregate (via its create()
// factory + mutators) so round-trip tests exercise the real reconstitution path.
import { Restaurant } from '../../../domain/catalog/entities/Restaurant';
import { MenuItem } from '../../../domain/catalog/entities/MenuItem';
import { ItemVariantGroup } from '../../../domain/catalog/entities/ItemVariantGroup';
import { Address } from '../../../domain/identity/value-objects/Address.vo';
import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';
import { GeoPolygon } from '../../../domain/catalog/value-objects/GeoPolygon.vo';
import { OpeningHours, WeeklySchedule } from '../../../domain/catalog/value-objects/OpeningHours.vo';
import { DeliveryFeeMatrix } from '../../../domain/catalog/value-objects/DeliveryFeeMatrix.vo';
import { ItemOption } from '../../../domain/catalog/entities/ItemOption';
import { Money } from '../../../domain/shared/Money';
import { WEEKDAY } from '../../../domain/catalog/enums/weekday.enum';
import { VARIANT_SELECTION_TYPE } from '../../../domain/catalog/enums/variant-selection-type.enum';
import { DietaryTag } from '../../../domain/catalog/enums/dietary-tag.enum';

export function buildAddress(): Address {
  const coordinates = GeoPoint.create(18.5204, 73.8567).getValue();
  return Address.create({
    label: 'Main',
    street: '12 FC Road',
    city: 'Pune',
    state: 'MH',
    pinCode: '411005',
    coordinates,
  }).getValue();
}

export function buildLocation(lat = 18.5204, lng = 73.8567): GeoPoint {
  return GeoPoint.create(lat, lng).getValue();
}

// A small square polygon (closed ring) around the given centre.
export function buildSquarePolygon(centerLat: number, centerLng: number, half = 0.01): GeoPolygon {
  const points = [
    GeoPoint.create(centerLat - half, centerLng - half).getValue(),
    GeoPoint.create(centerLat - half, centerLng + half).getValue(),
    GeoPoint.create(centerLat + half, centerLng + half).getValue(),
    GeoPoint.create(centerLat + half, centerLng - half).getValue(),
  ];
  return GeoPolygon.create(points).getValue();
}

export function buildFeeMatrix(): DeliveryFeeMatrix {
  return DeliveryFeeMatrix.create({
    tiers: [
      { maxDistanceMeters: 2000, fee: Money.create(2000).getValue() },
      { maxDistanceMeters: 5000, fee: Money.create(4000).getValue() },
    ],
    freeAboveSubtotal: Money.create(50000).getValue(),
  }).getValue();
}

export function buildOpeningHours(): OpeningHours {
  const day = [{ open: '09:00', close: '22:00' }];
  const schedule = {
    [WEEKDAY.MONDAY]: day,
    [WEEKDAY.TUESDAY]: day,
    [WEEKDAY.WEDNESDAY]: day,
    [WEEKDAY.THURSDAY]: day,
    [WEEKDAY.FRIDAY]: day,
    [WEEKDAY.SATURDAY]: day,
    [WEEKDAY.SUNDAY]: [],
  } as WeeklySchedule;
  return OpeningHours.create({ schedule, holidays: ['2026-12-25'] }).getValue();
}

export interface BuildRestaurantOpts {
  ownerId?: string;
  slug?: string;
  name?: string;
  cuisineTypes?: string[];
  withCategory?: boolean;
  withZone?: boolean;
  withOpeningHours?: boolean;
  centerLat?: number;
  centerLng?: number;
}

export function buildRestaurant(opts: BuildRestaurantOpts = {}): Restaurant {
  const lat = opts.centerLat ?? 18.5204;
  const lng = opts.centerLng ?? 73.8567;

  const restaurant = Restaurant.create({
    ownerId: opts.ownerId ?? 'owner-1',
    name: opts.name ?? 'Spice Garden',
    slug: opts.slug,
    description: 'Authentic North Indian',
    cuisineTypes: opts.cuisineTypes ?? ['NORTH_INDIAN', 'CHINESE'],
    address: buildAddress(),
    location: buildLocation(lat, lng),
    phone: '+919812345678',
    imageUrl: 'https://img.example.com/r.jpg',
  }).getValue();

  if (opts.withCategory ?? true) {
    restaurant.addCategory('Starters', 0);
  }
  if (opts.withZone) {
    restaurant.addZone({
      polygon: buildSquarePolygon(lat, lng),
      feeMatrix: buildFeeMatrix(),
      minOrder: Money.create(10000).getValue(),
    });
  }
  if (opts.withOpeningHours) {
    restaurant.setOpeningHours(buildOpeningHours());
  }

  return restaurant;
}

export interface BuildMenuItemOpts {
  restaurantId?: string;
  categoryId?: string;
  withVariants?: boolean;
  price?: number;
  name?: string;
  description?: string;
  tags?: string[];
  dietary?: string[];
}

export function buildMenuItem(opts: BuildMenuItemOpts = {}): MenuItem {
  const item = MenuItem.create({
    restaurantId: opts.restaurantId ?? 'rest-1',
    categoryId: opts.categoryId ?? 'cat-1',
    name: opts.name ?? 'Paneer Tikka',
    description: opts.description ?? 'Grilled cottage cheese',
    imageUrl: 'https://img.example.com/i.jpg',
    basePrice: Money.create(opts.price ?? 25000).getValue(),
    tags: opts.tags ?? ['spicy', 'popular'],
    dietary: (opts.dietary ?? ['VEG']) as DietaryTag[],
  }).getValue();

  if (opts.withVariants) {
    const small = ItemOption.create({ label: 'Half', priceDelta: Money.create(0).getValue(), isDefault: true }).getValue();
    const large = ItemOption.create({ label: 'Full', priceDelta: Money.create(10000).getValue() }).getValue();
    const group = ItemVariantGroup.create({
      label: 'Size',
      selectionType: VARIANT_SELECTION_TYPE.SINGLE,
      required: true,
      minSelect: 1,
      maxSelect: 1,
      options: [small, large],
    }).getValue();
    item.setItemVariants([group]);
  }

  return item;
}
