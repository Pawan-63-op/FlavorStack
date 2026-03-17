import express from 'express';
import {
  createReview,
  getReviews,
  getMyReviews,
  getRestaurantReviews,
  deleteReview,
  // getReviewsByRestaurant
} from '../controllers/reviewController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.route('/')
  .get(getReviews)
  .post(protect, createReview);

router.get('/myreviews', protect, getMyReviews);
router.get('/restaurant/:id', getRestaurantReviews);
router.delete('/:id', protect, deleteReview);
// router.get("/", protect, getReviewsByRestaurant);

export default router;
