import express from 'express';
import { 
  updateProfile, 
  getProfile,
  getAllUsers,
  deleteUser 
} from '../controllers/userController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.route('/profile')
  .get(protect, getProfile)
  .patch(protect, updateProfile);

router.route('/')
  .get(protect, admin, getAllUsers);

router.route('/:id')
  .delete(protect, admin, deleteUser);

export default router;
