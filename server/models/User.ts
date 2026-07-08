import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUser } from '@/Types/allTypes';

const userSchema = new Schema<IUser>({
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true
    
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please add a valid email']
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false
  },
  phone: {
    type: String,
    default: ''
  },
  location: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    default: ''
  },
  birthday: {
    type: String,
    default: ''
  },
  occupation: {
    type: String,
    default: ''
  },
  avatar: {
    type: String,
    default: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330'
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  loyaltyPoints: {
    type: Number,
    default: 500
  },
  loyaltyTier: {
    type: String,
    enum: ['Bronze', 'Silver', 'Gold', 'Platinum'],
    default: 'Bronze'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  resetPasswordToken: {
    type: String || undefined ,
    select: false
  },
  resetPasswordExpire: {
    type: Date || undefined ,
    select: false
  }
  
}, {
  timestamps: true
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function(enteredPassword: string): Promise<boolean> {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.updateLoyaltyTier = function(): void {
  if (this.loyaltyPoints >= 5000) {
    this.loyaltyTier = 'Platinum';
  } else if (this.loyaltyPoints >= 1500) {
    this.loyaltyTier = 'Gold';
  } else if (this.loyaltyPoints >= 500) {
    this.loyaltyTier = 'Silver';
  } else {
    this.loyaltyTier = 'Bronze';
  }
};

const User = mongoose.model<IUser>('User', userSchema);

export default User;
