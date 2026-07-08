import { Response } from 'express';
import User from '../models/User';
import { AuthRequest } from "@/Types/allTypes.js";

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?._id);
   res.status(201).json({user})
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?._id);

    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;
      user.phone = req.body.phone || user.phone;
      user.location = req.body.location || user.location;
      user.bio = req.body.bio || user.bio;
      user.birthday = req.body.birthday || user.birthday;
      user.occupation = req.body.occupation || user.occupation;
      user.avatar = req.body.avatar || user.avatar;

      const updatedUser = await user.save();

      res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        location: updatedUser.location,
        bio: updatedUser.bio,
        birthday: updatedUser.birthday,
        occupation: updatedUser.occupation,
        avatar: updatedUser.avatar,
        role: updatedUser.role,
        loyaltyPoints: updatedUser.loyaltyPoints,
        loyaltyTier: updatedUser.loyaltyTier
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const getAllUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await User.find({}).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id);

    if (user) {
      await user.deleteOne();
      res.json({ message: 'User removed' });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};
