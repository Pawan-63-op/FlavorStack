import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import crypto from 'crypto';
import User from '../models/User';
import OTP from '../models/OTP';
import {generateToken} from "@/utils/generateToken";
import { sendEmail } from '../config/email';
import { 
  getWelcomeEmailTemplate, 
  getVerificationEmailTemplate,
  getPasswordResetEmailTemplate,
  getResetSuccessEmailTemplate 
} from '../utils/emailTemplates';
import { AuthRequest} from "@/Types/allTypes.js";
import mongoose from 'mongoose';
import { _cidrv6 } from 'zod/v4/core';
const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { name, email, password } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      res.status(400).json({ message: 'User already exists with this email' });
      return;
    }

    const user = await User.create({
      name,
      email,
      password,
      isVerified: false
    });

    const otp = generateOTP();
    await OTP.create({
      email: user.email,
      otp,
      type: 'verification'
    });

    try {
      await sendEmail({
        email: user.email,
        subject: 'Verify Your Email - Delicious Bites',
        html: getVerificationEmailTemplate(user.name, otp)
      });
    } catch (emailError) {
      console.error('Email send failed:', emailError);
    }

    res.status(201).json({
      message: 'Registration successful! Please check your email for verification code.',
      email: user.email,
      requiresVerification: true
    });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp } = req.body;
console.log(email,otp);
    if (!email || !otp) {
      res.status(400).json({ message: 'Email and OTP are required' });
      return;
    }

    const otpDoc = await OTP.findOne({
      email: email.toLowerCase(),
      otp,
      type: 'verification',
      expiresAt: { $gt: new Date() }
    });

    if (!otpDoc) {
      res.status(400).json({ message: 'Invalid or expired OTP' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    user.isVerified = true;
    await user.save();

    await OTP.deleteMany({ email: email.toLowerCase(), type: 'verification' });

    try {
      await sendEmail({
        email: user.email,
        subject: 'Welcome to Delicious Bites!',
        html: getWelcomeEmailTemplate(user.name)
      });
    } catch (emailError) {
      console.error('Email send failed:', emailError);
    }
const curr= await generateToken(res,user);

    res.json({
      message: 'Email verified successfully!',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        loyaltyPoints: user.loyaltyPoints,
        loyaltyTier: user.loyaltyTier,
        isVerified: user.isVerified
      },
    });
  } catch (error) {
    res.status(500).json({message:'here only'});
  }
};

export const resendOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ message: 'Email is required' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if (user.isVerified) {
      res.status(400).json({ message: 'Email already verified' });
      return;
    }

    await OTP.deleteMany({ email: email.toLowerCase(), type: 'verification' });

    const otp = generateOTP();
    await OTP.create({
      email: user.email,
      otp,
      type: 'verification'
    });

    await sendEmail({
      email: user.email,
      subject: 'Verify Your Email - Delicious Bites',
      html: getVerificationEmailTemplate(user.name, otp)
    });

    res.json({ message: 'Verification code sent to your email' });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email, password } = req.body;
console.log(email,password);
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
console.log(user);
    if (!user || !(await user.matchPassword(password))) {
      console.log("invalid password");
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    if (!user.isVerified) {
      console.log("verify email first");
      res.status(403).json({ 
        message: 'Please verify your email first',
        requiresVerification: true,
        email: user.email
      });
      return;
    }
    console.log("op");
  const curr= generateToken(res,user);
console.log("curr",res.cookie);

    res.status(201).json({
      op:curr,
      user:{
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      loyaltyPoints: user.loyaltyPoints,
      loyaltyTier: user.loyaltyTier,
      isVerified: user.isVerified,
      bio:user.bio,
       phone:user.phone,
        location:user.location,
birthday:user.birthday,
occupation:user.occupation,
    }
   
    });
  } catch (error) {
     
     res.status(500).json({ message: (error as Error).message });
        
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ message: 'Email is required' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      res.status(404).json({ message: 'No account found with this email' });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    try {
      await sendEmail({
        email: user.email,
        subject: 'Password Reset Request - Delicious Bites',
        html: getPasswordResetEmailTemplate(user.name, resetToken)
      });

      res.json({ message: 'Password reset link sent to your email' });
    } catch (emailError) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();
      
      console.error('Email send failed:', emailError);
      res.status(500).json({ message: 'Failed to send email. Please try again.' });
    }
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      res.status(400).json({ message: 'Token and password are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters' });
      return;
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: new Date() }
    }).select('+resetPasswordToken +resetPasswordExpire');

    if (!user) {
      res.status(400).json({ message: 'Invalid or expired reset token' });
      return;
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    try {
      await sendEmail({
        email: user.email,
        subject: 'Password Reset Successful - Delicious Bites',
        html: getResetSuccessEmailTemplate(user.name)
      });
    } catch (emailError) {
      console.error('Email send failed:', emailError);
    }

    res.json({ 
      message: 'Password reset successful! You can now login with your new password.' 
    });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const checkAuth = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?._id);
    
    if (!user) {
      res.status(404).json({ message: 'User not found', isAuthenticated: false });
      return;
    }

     res.status(201).json({
      isAuthenticated: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        loyaltyPoints: user.loyaltyPoints,
        loyaltyTier: user.loyaltyTier,
        isVerified: user.isVerified
      }
    });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message, isAuthenticated: false });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?._id);
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const logout = async (req: Request, res: Response) => {
    try {
     const token = req.cookies.token;
        return res.clearCookie("token").status(200).json({
            success: true,
            message: "Logged out successfully."
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal server error" })
    }
};
export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const allowedFields = ["name",  "phone", "location", "bio", "birthday", "occupation"];
    const updates: any = {};

    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields provided for update" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true } // runValidators ensures schema validation still applies
    ).select("-password"); // hide password in response

    res.status(200).json({
      message: "Profile updated successfully",
      user,
    });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ message: "Update failed" });
  }
};