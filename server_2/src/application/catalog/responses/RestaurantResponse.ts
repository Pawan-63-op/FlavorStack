import { WeeklySchedule } from '../../../domain/catalog/value-objects/OpeningHours.vo';

export interface MoneyResponse {
  amount: number;
  currency: string;
}

export interface CategoryResponse {
  id: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

export interface DeliveryZoneResponse {
  id: string;
  polygon: { points: { lat: number; lng: number }[] };
  feeMatrix: {
    tiers: { maxDistanceMeters: number; fee: MoneyResponse }[];
    freeAboveSubtotal?: MoneyResponse;
  };
  minOrder: MoneyResponse;
}

export interface RestaurantResponse {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  description?: string;
  cuisineTypes: string[];
  address: {
    label?: string;
    street: string;
    city: string;
    state: string;
    pinCode: string;
    coordinates: { lat: number; lng: number };
  };
  location: { lat: number; lng: number };
  phone: string;
  imageUrl?: string;
  status: string;
  visibility: string;
  categories: CategoryResponse[];
  openingHours?: { schedule: WeeklySchedule; holidays: string[] };
  deliveryZones: DeliveryZoneResponse[];
  version: number;
}
