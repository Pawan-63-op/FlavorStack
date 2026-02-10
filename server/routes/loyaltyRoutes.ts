import express from 'express';
import {
  getLoyaltyInfo,
  getLoyaltyTransactions,
  redeemPoints
} from '../controllers/loyaltyController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/info', protect, getLoyaltyInfo);
router.get('/transactions', protect, getLoyaltyTransactions);
router.post('/redeem', protect, redeemPoints);

export default router;
