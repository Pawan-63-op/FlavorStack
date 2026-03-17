import express from 'express';
import {
  getRestaurants,
  getRestaurantById,
  createRestaurant,
 updatedRestaurant,
  deleteRestaurant,
  searchRestaurants,
  getRestaurantMenu
} from '../controllers/restaurantController';
import { getRestaurantOrders,getOrderStats } from '@/controllers/orderController';
import { protect, admin } from '../middleware/authMiddleware';
import upload from '@/middlewares/multer';
const router = express.Router();

router.route('/')
  .get(getRestaurants)
  .post(protect, admin,upload.single("imageFile"), createRestaurant);
router.get('/search', searchRestaurants);
router.route('/').patch(protect, admin, updatedRestaurant);
router.route('/:id')
  .get(protect,getRestaurantById)
  .patch(protect, admin, upload.single("imageFile"),updatedRestaurant)
  .delete(protect, admin, deleteRestaurant);
router.get('/:restaurantId/menu', protect, getRestaurantMenu);
router.get('/:restaurantId/orders', protect, admin, getRestaurantOrders);
router.get('/:restaurantId/stats', protect, admin, getOrderStats);
export default router;
