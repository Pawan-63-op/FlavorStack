import { Schema, model } from 'mongoose';
import { RestaurantSnapshotJSON } from '../../../domain/commerce/value-objects/snapshots/RestaurantSnapshot';
import { MenuItemSnapshotJSON } from '../../../domain/commerce/value-objects/snapshots/MenuItemSnapshot';
import { VariantSnapshotJSON } from '../../../domain/commerce/value-objects/snapshots/VariantSnapshot';
import { PricingBreakdownJSON } from '../../../domain/commerce/value-objects/snapshots/snapshot-serialization';

export interface MoneyDocument {
  amount: number;
  currency: string;
}

export interface AddressDocument {
  label?: string;
  street: string;
  city: string;
  state: string;
  pinCode: string;
  coordinates: { lat: number; lng: number };
}

export interface OrderRequestLineDocument {
  id: string;
  menuItem: MenuItemSnapshotJSON;
  selectedOptions: VariantSnapshotJSON[];
  quantity: number;
  lineTotal: MoneyDocument;
}

export interface OrderRequestDocument {
  _id: string;
  customerId: string;
  idempotencyKey: string;
  restaurant: RestaurantSnapshotJSON;
  lines: OrderRequestLineDocument[];
  pricing: PricingBreakdownJSON;
  deliveryAddress: AddressDocument;
  paymentIntent: { method: string };
  status: string;
  schemaVersion: number;
  createdAt: Date;
}

const MoneySchema = new Schema<MoneyDocument>(
  {
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
  },
  { _id: false }
);

const MenuItemSnapshotSchema = new Schema<MenuItemSnapshotJSON>(
  {
    menuItemId: { type: String, required: true },
    name: { type: String, required: true },
    basePrice: { type: MoneySchema, required: true },
    categoryId: { type: String, required: true },
    schemaVersion: { type: Number, required: true },
  },
  { _id: false }
);

const VariantSnapshotSchema = new Schema<VariantSnapshotJSON>(
  {
    optionId: { type: String, required: true },
    label: { type: String, required: true },
    priceDelta: { type: MoneySchema, required: true },
    schemaVersion: { type: Number, required: true },
  },
  { _id: false }
);

const FeeSchema = new Schema(
  {
    type: { type: String, required: true },
    amount: { type: MoneySchema, required: true },
  },
  { _id: false }
);

const PricingSchema = new Schema<PricingBreakdownJSON>(
  {
    subtotal: { type: MoneySchema, required: true },
    fees: { type: [FeeSchema], default: [] },
    discount: { type: MoneySchema, required: true },
    tax: { type: MoneySchema, required: true },
    total: { type: MoneySchema, required: true },
  },
  { _id: false }
);

const DeliveryFeeTierSchema = new Schema(
  {
    maxDistanceMeters: { type: Number, required: true },
    fee: { type: MoneySchema, required: true },
  },
  { _id: false }
);

const DeliveryFeeInputsSchema = new Schema(
  {
    feeTiers: { type: [DeliveryFeeTierSchema], default: [] },
    freeAboveSubtotal: { type: MoneySchema, required: false },
  },
  { _id: false }
);

const RestaurantSnapshotSchema = new Schema<RestaurantSnapshotJSON>(
  {
    restaurantId: { type: String, required: true },
    name: { type: String, required: true },
    status: { type: String, required: true },
    openAtCheckout: { type: Boolean, required: true },
    deliveryFeeInputs: { type: DeliveryFeeInputsSchema, required: true },
    schemaVersion: { type: Number, required: true },
  },
  { _id: false }
);

const GeoPointSchema = new Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { _id: false }
);

const AddressSchema = new Schema<AddressDocument>(
  {
    label: { type: String, required: false },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pinCode: { type: String, required: true },
    coordinates: { type: GeoPointSchema, required: true },
  },
  { _id: false }
);

const PaymentIntentSchema = new Schema(
  {
    method: { type: String, required: true },
  },
  { _id: false }
);

const OrderRequestLineSchema = new Schema<OrderRequestLineDocument>(
  {
    id: { type: String, required: true },
    menuItem: { type: MenuItemSnapshotSchema, required: true },
    selectedOptions: { type: [VariantSnapshotSchema], default: [] },
    quantity: { type: Number, required: true },
    lineTotal: { type: MoneySchema, required: true },
  },
  { _id: false }
);

const OrderRequestSchema = new Schema<OrderRequestDocument>(
  {
    _id: { type: String, required: true },
    customerId: { type: String, required: true },
    idempotencyKey: { type: String, required: true },
    restaurant: { type: RestaurantSnapshotSchema, required: true },
    lines: { type: [OrderRequestLineSchema], default: [] },
    pricing: { type: PricingSchema, required: true },
    deliveryAddress: { type: AddressSchema, required: true },
    paymentIntent: { type: PaymentIntentSchema, required: true },
    status: { type: String, required: true },
    schemaVersion: { type: Number, required: true },
    createdAt: { type: Date, required: true },
  },
  {
    versionKey: false,
    timestamps: false,
    collection: 'order_requests',
  }
);

OrderRequestSchema.index({ idempotencyKey: 1 }, { unique: true });
OrderRequestSchema.index({ customerId: 1, createdAt: -1 });

export const OrderRequestModel = model<OrderRequestDocument>('OrderRequest', OrderRequestSchema);
