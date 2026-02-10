
import mongoose from 'mongoose';
import { AuthRequest } from '@/Types/allTypes';
import Coupon from '../models/Coupon';
import { Express } from 'express';
// 
import { Response,Request } from 'express';
import error from "express";
// @desc    Get all active coupons
// @route   GET /api/coupons
// @access  Public
export const getCoupons = async (req:Request, res:Response) => {
  try {
    const coupons = await Coupon.find({ 
      // isActive: true,
      // validUntil: { $gte: new Date() }
    }).sort('-createdAt');
    res.status(201).json({coupons});
  } catch (error : any ) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create coupon
// @route   POST /api/coupons
// @access  Private/Admin
export const createCoupon = async (req:AuthRequest, res:Response) => {
  try {
    const coupon = await Coupon.create({
      ...req.body,
      createdBy: req.user?._id,
      validUntil: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000)

    });
    res.status(201).json({coupon});
  } catch (error : any) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Coupon code already exists' });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update coupon
// @route   PUT /api/coupons/:id
// @access  Private/Admin
export const updateCoupon = async (req:Request, res:Response) => {
  // res.status(201).json({op:req.params.id , answer : type req.params.id});m
// const objectId = new mongoose.Types.ObjectId(idString);

  try {
    const idString= req.params.id;
    const coupon = await Coupon.findById(new mongoose.Types.ObjectId(idString));
    if (coupon) {
      Object.assign(coupon, req.body);
      const updatedCoupon = await coupon.save();
      res.status(200).json({updatedCoupon});
    } else {
      res.status(404).json({ message: 'Coupon not found' });
    }
  } catch (error : any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete coupon
// @route   DELETE /api/coupons/:id
// @access  Private/Admin
export const deleteCoupon = async (req:Request, res:Response) => {
  try {
    // const coupon = await Coupon.findById(req.params.id);
 const idString= req.params.id;
  // res.status(201).json({ message: idString});
    const coupon = await Coupon.findById(new mongoose.Types.ObjectId(idString));
    if (coupon) {
      await coupon.deleteOne();
      res.status(201).json({ message: 'Coupon removed' });
    } else {
      res.status(404).json({ message: 'Coupon not found' });
    }
  } catch (error :any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Validate coupon
// @route   POST /api/coupons/validate
// @access  Private
export const validateCoupon = async (req:Request, res:Response) => {
  try {
    const { code, orderTotal } = req.body;

    const coupon = await Coupon.findOne({ 
      code: code.toUpperCase(),
      isActive: true,
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() }
    });

    if (!coupon) {
      return res.status(404).json({ 
        valid: false, 
        message: 'Invalid or expired coupon code' 
      });
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ 
        valid: false, 
        message: 'Coupon usage limit reached' 
      });
    }

    // Check minimum order
    if (coupon.minOrder && orderTotal < coupon.minOrder) {
      return res.status(400).json({ 
        valid: false, 
        message: `Minimum order of $${coupon.minOrder} required` 
      });
    }

    // Calculate discount
    let discount = 0;
    if (coupon.type === 'percentage') {
      discount = (orderTotal * coupon.discount) / 100;
      if (coupon.maxDiscount) {
        discount = Math.min(discount, coupon.maxDiscount);
      }
    } else if (coupon.type === 'fixed') {
      discount = coupon.discount;
    } else if (coupon.type === 'shipping') {
      discount = coupon.discount;
    }

    // Increment usage count
    coupon.usedCount += 1;
    await coupon.save();

    res.json({
      valid: true,
      message: 'Coupon applied successfully',
      coupon: {
        code: coupon.code,
        type: coupon.type,
        discount: coupon.discount,
        description: coupon.description
      },
      discountAmount: discount
    });
  } catch (error:any) {
    res.status(500).json({ message: error });
  }
};
export const toggleCoupon = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const updatedCoupon = await Coupon.findByIdAndUpdate(
      id,
      { isActive },
      { new: true }
    );

    if (!updatedCoupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    res.status(200).json(updatedCoupon);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};