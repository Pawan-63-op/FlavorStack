import express from 'express';
import multer from 'multer';
import { uploadImage, deleteImage } from '../controllers/uploadController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
     cb(null, false);
      (req as any).fileValidationError = "Not an image! Please upload an image.";
    }
  }
});

router.post('/', protect, upload.single('image'), uploadImage);
router.delete('/:publicId', protect, deleteImage);

export default router;
