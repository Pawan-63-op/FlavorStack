import mongoose, { Schema, Document } from 'mongoose';

export interface IOTP extends Document {
  email: string;
  otp: string;
  type: 'verification' | 'password-reset';
  expiresAt: Date;
  createdAt: Date;
}

const otpSchema = new Schema<IOTP>({
  email: {
    type: String,
    required: true,
    lowercase: true
  },
  otp: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['verification', 'password-reset'],
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
  }
}, {
  timestamps: true
});

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const OTP = mongoose.model<IOTP>('OTP', otpSchema);

export default OTP;
