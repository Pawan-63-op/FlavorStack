import User from '../models/User';
import LoyaltyTransaction from '../models/LoyaltyTransaction';
import { AuthRequest,IUser } from '@/Types/allTypes';
import { Response } from 'express';
export const getLoyaltyInfo = async (req:AuthRequest,res:Response) => {
  try {
    const user = await User.findById(req.user?._id);
    
    const tiers = [
      { name: 'Bronze', minPoints: 0, benefits: ['1 point per $1 spent', 'Birthday reward'] },
      { name: 'Silver', minPoints: 500, benefits: ['1.5 points per $1 spent', 'Free delivery once a month', 'Priority support'] },
      { name: 'Gold', minPoints: 1500, benefits: ['2 points per $1 spent', 'Free delivery unlimited', 'Exclusive offers', 'Early access to new restaurants'] },
      { name: 'Platinum', minPoints: 5000, benefits: ['3 points per $1 spent', 'VIP concierge', 'Premium support', 'Special events access'] }
    ];

    const currentTierIndex = tiers.findIndex(t => t.name === user?.loyaltyTier);
    const nextTier = currentTierIndex < tiers.length - 1 ? tiers[currentTierIndex + 1] : null;
    const pointsToNext = nextTier ? nextTier.minPoints - user?.loyaltyPoints! : 0;

     res.status(400).json({
      points: user?.loyaltyPoints!,
      tier: user?.loyaltyTier,
      currentTier: tiers[currentTierIndex],
      nextTier,
      pointsToNext: Math.max(0, pointsToNext),
      allTiers: tiers
    });
  } catch (error:any) {
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

export const getLoyaltyTransactions = async (req:AuthRequest,res:Response) => {
  try {
    const transactions = await LoyaltyTransaction.find({ user: req.user?._id })
      .populate('order', 'orderId')
      .sort('-createdAt')
      .limit(50);
   return res.status(201).json(transactions);
  } catch (error:any) {
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

export const redeemPoints = async (req:AuthRequest,res:Response) => {
  try {
    const { points, description } = req.body;
    const user = await User.findById(req.user?._id);
    
    if (user?.loyaltyPoints! < points) {
      return res.status(400).json({ message: 'Insufficient points' });
    }

    if(user?.loyaltyPoints ) user.loyaltyPoints -= points;
    user?.updateLoyaltyTier();
    await user?.save();

    await LoyaltyTransaction.create({
      user: req.user?._id,
      type: 'redeemed',
      points,
      description
    });

    res.json({
      message: 'Points redeemed successfully',
      remainingPoints: user?.loyaltyPoints,
      tier: user?.loyaltyTier
    });
  } catch (error:any) {
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};
