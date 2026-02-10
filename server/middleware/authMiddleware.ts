import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { AuthRequest } from '@/Types/allTypes';

// Protect routes
export const protect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const token = req.cookies.token;
  console.log(token,"token as follows");
  if (!token) {
    res.status(401).json({ message: 'Not alavaduthorized, no token' });
    return;
  }
 try {
     const decoded = jwt.verify(token, process.env.JWT_SECRET!) as jwt.JwtPayload;
    
      // // Get user from token
      req.user = await User.findById(decoded.id).select('-password') as any;

      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Not authorized, token failed' });
      return;
    }
};
  
// Admin only
export const admin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as admin' });
  }
};
