import express from 'express';
import {
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
  toggleCoupon
} from '../controllers/couponController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.route('/')
  .get(getCoupons)
  .post(protect, admin, createCoupon);

router.post('/validate', protect, validateCoupon);

router.route('/:id')
  .patch(protect, admin, updateCoupon)
  .delete(protect, admin, deleteCoupon);
router.patch('/:id/toggle', toggleCoupon);


export default router;
