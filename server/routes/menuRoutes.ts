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


router.get('/', getMenuItems);
router.get('/:id', getMenuItemById);

router.post('/', protect, admin, upload.single('imageFile'), createMenuItem);
router.patch('/:id', protect, admin, upload.single('imageFile'), updateMenuItem);
router.delete('/:id', protect, admin, deleteMenuItem);
export default router;
