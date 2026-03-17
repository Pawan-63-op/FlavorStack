import mongoose, { Schema, Document } from "mongoose";

export interface IMessage extends Document {
  room: string;              // userId of the customer
  text: string;
  senderRole: "customer" | "admin";
  senderName: string;
  isRead: boolean;
  createdAt: Date;
}

export interface IConversation extends Document {
  userId: string;
  userName: string;
  userEmail: string;
  status: "open" | "resolved";
  lastMessage: string;
  lastMessageAt: Date;
  unreadCount: number;
}

const MessageSchema = new Schema<IMessage>(
  {
    room:        { type: String, required: true, index: true },
    text:        { type: String, required: true },
    senderRole:  { type: String, enum: ["customer", "admin"], required: true },
    senderName:  { type: String, default: "" },
    isRead:      { type: Boolean, default: false },
  },
  { timestamps: true }
);

const ConversationSchema = new Schema<IConversation>(
  {
    userId:        { type: String, required: true, unique: true },
    userName:      { type: String, default: "Customer" },
    userEmail:     { type: String, default: "" },
    status:        { type: String, enum: ["open", "resolved"], default: "open" },
    lastMessage:   { type: String, default: "" },
    lastMessageAt: { type: Date, default: Date.now },
    unreadCount:   { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Message      = mongoose.model<IMessage>("Message", MessageSchema);
export const Conversation = mongoose.model<IConversation>("Conversation", ConversationSchema);
