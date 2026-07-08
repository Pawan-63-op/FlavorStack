import { Schema, model } from 'mongoose';
import { RESTAURANT_STATUS, RestaurantStatus } from '../../../domain/catalog/enums/restaurant-status.enum';
import { CATALOG_VISIBILITY, CatalogVisibility } from '../../../domain/catalog/enums/catalog-visibility.enum';

export interface MoneyDocument {
  amount: number;
  currency: string;
}

export interface GeoJsonPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: [number, number][][]; // [ring][[lng, lat], ...]
}

export interface AddressDocument {
  label?: string;
  street: string;
  city: string;
  state: string;
  pinCode: string;
  coordinates: { lat: number; lng: number };
}

export interface CategoryDocument {
  id: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

export interface DeliveryFeeTierDocument {
  maxDistanceMeters: number;
  fee: MoneyDocument;
}

export interface DeliveryZoneDocument {
  id: string;
  polygon: GeoJsonPolygon;
  feeMatrix: {
    tiers: DeliveryFeeTierDocument[];
    freeAboveSubtotal: MoneyDocument | null;
  };
  minOrder: MoneyDocument;
}

export interface DayIntervalDocument {
  open: string;
  close: string;
}

export interface OpeningHoursDocument {
  schedule: Record<string, DayIntervalDocument[]>;
  holidays: string[];
}

export interface RestaurantDocument {
  _id: string;
  ownerId: string;
  name: string;
  slug: string;
  description: string | null;
  cuisineTypes: string[];
  address: AddressDocument;
  location: GeoJsonPoint;
  phone: string;
  imageUrl: string | null;
  status: RestaurantStatus;
  visibility: CatalogVisibility;
  categories: CategoryDocument[];
  openingHours: OpeningHoursDocument | null;
  deliveryZones: DeliveryZoneDocument[];
  version: number;
  deletedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const MoneySchema = new Schema<MoneyDocument>(
  {
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
  },
  { _id: false }
);

const CategorySchema = new Schema<CategoryDocument>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    sortOrder: { type: Number, required: true },
    isActive: { type: Boolean, required: true },
  },
  { _id: false }
);

const DeliveryZoneSchema = new Schema<DeliveryZoneDocument>(
  {
    id: { type: String, required: true },
    polygon: {
      type: { type: String, enum: ['Polygon'], required: true },
      coordinates: { type: [[[Number]]], required: true },
    },
    feeMatrix: {
      tiers: {
        type: [
          new Schema<DeliveryFeeTierDocument>(
            {
              maxDistanceMeters: { type: Number, required: true },
              fee: { type: MoneySchema, required: true },
            },
            { _id: false }
          ),
        ],
        default: [],
      },
      freeAboveSubtotal: { type: MoneySchema, default: null },
    },
    minOrder: { type: MoneySchema, required: true },
  },
  { _id: false }
);

const RestaurantSchema = new Schema<RestaurantDocument>(
  {
    _id: { type: String, required: true },
    ownerId: { type: String, required: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    description: { type: String, default: null },
    cuisineTypes: { type: [String], default: [] },
    address: {
      label: { type: String },
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pinCode: { type: String, required: true },
      coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
    },
    location: {
      type: { type: String, enum: ['Point'], required: true },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    phone: { type: String, required: true },
    imageUrl: { type: String, default: null },
    status: { type: String, enum: Object.values(RESTAURANT_STATUS), required: true },
    visibility: { type: String, enum: Object.values(CATALOG_VISIBILITY), required: true },
    categories: { type: [CategorySchema], default: [] },
    openingHours: {
      type: new Schema<OpeningHoursDocument>(
        {
          schedule: { type: Schema.Types.Mixed, required: true },
          holidays: { type: [String], default: [] },
        },
        { _id: false }
      ),
      default: null,
    },
    deliveryZones: { type: [DeliveryZoneSchema], default: [] },
    version: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  {
    versionKey: false,
    timestamps: true,
    collection: 'restaurants',
  }
);

RestaurantSchema.index({ slug: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });
RestaurantSchema.index({ ownerId: 1 });
RestaurantSchema.index({ status: 1 });
RestaurantSchema.index({ cuisineTypes: 1 });
RestaurantSchema.index({ deletedAt: 1 }, { sparse: true });
RestaurantSchema.index({ location: '2dsphere' });
RestaurantSchema.index({ 'deliveryZones.polygon': '2dsphere' });
RestaurantSchema.index({ name: 'text', description: 'text' });

export const RestaurantModel = model<RestaurantDocument>('Restaurant', RestaurantSchema);
