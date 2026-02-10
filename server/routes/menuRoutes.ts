import express from 'express';
import {
  getMenuItems,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem
} from '../controllers/menuController';
import { protect, admin } from '../middleware/authMiddleware';
import upload from '@/middlewares/multer';
const router = express.Router();

// router.route('/')
//   .get(getMenuItems)
//   .post(protect, admin, createMenuItem);

// router.route('/:id')
//   .get(getMenuItemById)
//   .put(protect, admin, updateMenuItem)
//   .delete(protect, admin, deleteMenuItem);
router.get('/', getMenuItems);
router.get('/:id', getMenuItemById);

// Protected routes (require authentication and admin)
router.post('/', protect, admin, upload.single('imageFile'), createMenuItem);
router.patch('/:id', protect, admin, upload.single('imageFile'), updateMenuItem);
router.delete('/:id', protect, admin, deleteMenuItem);
export default router;
