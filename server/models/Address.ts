import mongoose, { Schema, Document } from "mongoose";

export interface IAddress extends Document {
  user: mongoose.Types.ObjectId;
  label: string;        // "Home" | "Work" | "Other"
  name: string;         // recipient name
  phone: string;
  address: string;      // full address string
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema = new Schema<IAddress>(
  {
    user:      { type: Schema.Types.ObjectId, ref: "User", required: true },
    label:     { type: String, default: "Home" },
    name:      { type: String, required: true },
    phone:     { type: String, required: true },
    address:   { type: String, required: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model<IAddress>("Address", AddressSchema);
