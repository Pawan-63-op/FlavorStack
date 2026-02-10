import express from 'express';
import {
  getFavorites,
  addRestaurantToFavorites,
  removeRestaurantFromFavorites,
  addRecipeToFavorites,
  removeRecipeFromFavorites
} from '../controllers/favoriteController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/', protect, getFavorites);
router.post('/restaurant/:id', protect, addRestaurantToFavorites);
router.delete('/restaurant/:id', protect, removeRestaurantFromFavorites);
router.post('/recipe/:id', protect, addRecipeToFavorites);
router.delete('/recipe/:id', protect, removeRecipeFromFavorites);

export default router;
