import { Restaurant } from '../../../../domain/catalog/entities/Restaurant';
import { MenuItem } from '../../../../domain/catalog/entities/MenuItem';
import { Address } from '../../../../domain/identity/value-objects/Address.vo';
import { GeoPoint } from '../../../../domain/identity/value-objects/GeoPoint.vo';
import { GeoPolygon } from '../../../../domain/catalog/value-objects/GeoPolygon.vo';
import { DeliveryFeeMatrix } from '../../../../domain/catalog/value-objects/DeliveryFeeMatrix.vo';
import { Money } from '../../../../domain/shared/Money';
import { CUISINE_TYPE } from '../../../../domain/catalog/enums/cuisine-type.enum';

export function buildAddress() {
  return Address.create({
    street: '12 MG Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    pinCode: '560001',
    coordinates: GeoPoint.create(12.97, 77.59).getValue(),
  }).getValue();
}

export function money(amount: number, currency = 'INR') {
  return Money.create(amount, currency).getValue();
}

export function buildPolygon(offset = 0) {
  return GeoPolygon.create([
    GeoPoint.create(0 + offset, 0 + offset).getValue(),
    GeoPoint.create(0 + offset, 1 + offset).getValue(),
    GeoPoint.create(1 + offset, 1 + offset).getValue(),
    GeoPoint.create(1 + offset, 0 + offset).getValue(),
  ]).getValue();
}

export function buildFeeMatrix() {
  return DeliveryFeeMatrix.create({
    tiers: [{ maxDistanceMeters: 2000, fee: money(2000) }],
  }).getValue();
}

/** Restaurant owned by 'owner-1' with one active category named 'Mains'. */
export function buildRestaurant(): Restaurant {
  const restaurant = Restaurant.create({
    ownerId: 'owner-1',
    name: 'Spice Garden',
    cuisineTypes: [CUISINE_TYPE.NORTH_INDIAN],
    address: buildAddress(),
    location: GeoPoint.create(12.97, 77.59).getValue(),
    phone: '+919876543210',
  }).getValue();
  restaurant.addCategory('Mains');
  restaurant.pullDomainEvents();
  return restaurant;
}

export function buildMenuItem(restaurantId: string, categoryId: string): MenuItem {
  const menuItem = MenuItem.create({
    restaurantId,
    categoryId,
    name: 'Paneer Tikka',
    basePrice: money(25000),
  }).getValue();
  menuItem.pullDomainEvents();
  return menuItem;
}
