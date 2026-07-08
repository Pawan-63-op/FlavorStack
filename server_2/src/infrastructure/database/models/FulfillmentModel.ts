import { Schema, model } from 'mongoose';

export interface MoneyDocument {
  amount: number;
  currency: string;
}

export interface FulfillmentLineOptionDocument {
  optionId: string;
  label: string;
  priceDelta: MoneyDocument;
}

export interface FulfillmentLineDocument {
  menuItemId: string;
  name: string;
  quantity: number;
  selectedOptions: FulfillmentLineOptionDocument[];
  lineTotal: MoneyDocument;
}

export interface FulfillmentDeliveryAddressDocument {
  label?: string;
  street: string;
  city: string;
  state: string;
  pinCode: string;
  coordinates: { lat: number; lng: number };
}

export interface RiderAssignmentDocument {
  id: string;
  riderId: string;
  status: string;
  attempt: number;
  offeredAt: Date;
  acceptedAt?: Date | null;
  respondedAt?: Date | null;
  expiresAt: Date;
}

export interface CancellationInfoDocument {
  cancelledBy: string;
  reason: string;
  at: Date;
}

export interface FulfillmentDocument {
  _id: string;
  orderRequestId: string;
  customerId: string;
  restaurantId: string;
  lines: FulfillmentLineDocument[];
  deliveryAddress: FulfillmentDeliveryAddressDocument;
  pricingTotal: MoneyDocument;
  fulfillmentStatus: string;
  deliveryStatus: string;
  currentAssignment?: RiderAssignmentDocument | null;
  assignmentHistory: RiderAssignmentDocument[];
  cancellation?: CancellationInfoDocument | null;
  failureReason?: string | null;
  prepEstimateMinutes?: number;
  createdAt: Date;
  updatedAt: Date;
  readyAt?: Date;
  pickedUpAt?: Date;
  deliveredAt?: Date;
  version: number;
}

const MoneySchema = new Schema<MoneyDocument>(
  {
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
  },
  { _id: false }
);

const FulfillmentLineOptionSchema = new Schema<FulfillmentLineOptionDocument>(
  {
    optionId: { type: String, required: true },
    label: { type: String, required: true },
    priceDelta: { type: MoneySchema, required: true },
  },
  { _id: false }
);

const FulfillmentLineSchema = new Schema<FulfillmentLineDocument>(
  {
    menuItemId: { type: String, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    selectedOptions: { type: [FulfillmentLineOptionSchema], default: [] },
    lineTotal: { type: MoneySchema, required: true },
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

const DeliveryAddressSchema = new Schema<FulfillmentDeliveryAddressDocument>(
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

const RiderAssignmentSchema = new Schema<RiderAssignmentDocument>(
  {
    id: { type: String, required: true },
    riderId: { type: String, required: true },
    status: { type: String, required: true },
    attempt: { type: Number, required: true },
    offeredAt: { type: Date, required: true },
    acceptedAt: { type: Date, required: false, default: null },
    respondedAt: { type: Date, required: false, default: null },
    expiresAt: { type: Date, required: true },
  },
  { _id: false }
);

const CancellationInfoSchema = new Schema<CancellationInfoDocument>(
  {
    cancelledBy: { type: String, required: true },
    reason: { type: String, required: true },
    at: { type: Date, required: true },
  },
  { _id: false }
);

const FulfillmentSchema = new Schema<FulfillmentDocument>(
  {
    _id: { type: String, required: true },
    orderRequestId: { type: String, required: true },
    customerId: { type: String, required: true },
    restaurantId: { type: String, required: true },
    lines: { type: [FulfillmentLineSchema], default: [] },
    deliveryAddress: { type: DeliveryAddressSchema, required: true },
    pricingTotal: { type: MoneySchema, required: true },
    fulfillmentStatus: { type: String, required: true },
    deliveryStatus: { type: String, required: true, default: 'UNASSIGNED' },
    currentAssignment: { type: RiderAssignmentSchema, required: false, default: null },
    assignmentHistory: { type: [RiderAssignmentSchema], default: [] },
    cancellation: { type: CancellationInfoSchema, required: false, default: null },
    failureReason: { type: String, required: false, default: null },
    prepEstimateMinutes: { type: Number, required: false },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    readyAt: { type: Date, required: false },
    pickedUpAt: { type: Date, required: false },
    deliveredAt: { type: Date, required: false },
    version: { type: Number, required: true, default: 0 },
  },
  {
    versionKey: false,
    timestamps: false,
    collection: 'fulfillments',
  }
);

FulfillmentSchema.index({ orderRequestId: 1 }, { unique: true });
FulfillmentSchema.index({ restaurantId: 1, fulfillmentStatus: 1 });
FulfillmentSchema.index({ 'currentAssignment.riderId': 1, deliveryStatus: 1 });
FulfillmentSchema.index({ customerId: 1, createdAt: -1 });

export const FulfillmentModel = model<FulfillmentDocument>('Fulfillment', FulfillmentSchema);
