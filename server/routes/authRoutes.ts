import express from 'express';
import { body } from 'express-validator';
import { 
  register, 
  login, 
  verifyEmail,
  resendOTP,
  forgotPassword,
  resetPassword,
  checkAuth,
  getMe, 
  logout 
} from '@/controllers/authController';
import { protect } from '../middleware/authMiddleware';
import { Request,Response } from 'express';
const router = express.Router();
import { updateProfile } from '@/controllers/authController';

router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  register
);
// router.get('/register_x', (req:Request, res:Response ) => {
//    res.status(400).json({ status: 'OK', message: 'Server is running' });
// });

router.post('/verify-email', verifyEmail);
router.post('/resend-otp', resendOTP);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  login
);

router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.patch('/update-profile', protect, updateProfile);

router.get('/check-auth', protect, checkAuth);
router.get('/me', protect, getMe);
router.post('/logout', logout);

export default router;
