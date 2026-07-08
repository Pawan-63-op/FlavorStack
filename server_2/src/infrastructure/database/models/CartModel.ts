import { Schema, model } from 'mongoose';

export interface MoneyDocument {
  amount: number;
  currency: string;
}

export interface CartItemDocument {
  id: string;
  menuItemId: string;
  quantity: number;
  selectedOptionIds: string[];
  unitPriceSnapshot: MoneyDocument;
}

export interface AppliedPromotionDocument {
  code: string;
  kind: string;
  discount: MoneyDocument;
  sourceRef: string;
}

export interface CartDocument {
  _id: string;
  customerId: string;
  restaurantId: string | null;
  items: CartItemDocument[];
  currency: string | null;
  appliedPromotion: AppliedPromotionDocument | null;
  version: number;
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

const CartItemSchema = new Schema<CartItemDocument>(
  {
    id: { type: String, required: true },
    menuItemId: { type: String, required: true },
    quantity: { type: Number, required: true },
    selectedOptionIds: { type: [String], default: [] },
    unitPriceSnapshot: { type: MoneySchema, required: true },
  },
  { _id: false }
);

const AppliedPromotionSchema = new Schema<AppliedPromotionDocument>(
  {
    code: { type: String, required: true },
    kind: { type: String, required: true },
    discount: { type: MoneySchema, required: true },
    sourceRef: { type: String, required: true },
  },
  { _id: false }
);

const CartSchema = new Schema<CartDocument>(
  {
    _id: { type: String, required: true },
    customerId: { type: String, required: true },
    restaurantId: { type: String, default: null },
    items: { type: [CartItemSchema], default: [] },
    currency: { type: String, default: null },
    appliedPromotion: { type: AppliedPromotionSchema, default: null },
    version: { type: Number, default: 0 },
  },
  {
    versionKey: false,
    timestamps: true,
    collection: 'carts',
  }
);

CartSchema.index({ customerId: 1 }, { unique: true });
CartSchema.index({ updatedAt: 1 });

export const CartModel = model<CartDocument>('Cart', CartSchema);
