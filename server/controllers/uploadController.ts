import cloudinary from '../config/cloudinary';
import { Readable } from 'stream';
import {Request,Response} from 'express';
import { AuthRequest } from '@/Types/allTypes';

// @desc    Upload image to Cloudinary
// @route   POST /api/upload
// @access  Private
export const uploadImage = async (req:Request, res:Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a file' });
    }

    // Convert buffer to stream
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'food-delivery',
        resource_type: 'auto'
      },
      (error, result) => {
        if (error) {
          return res.status(500).json({ message: 'Upload failed', error: error.message });
        }
        
        res.json({
          url: result?.secure_url,
          publicId: result?.public_id
        });
      }
    );

    // Pipe the buffer to the stream
    Readable.from(req.file.buffer).pipe(stream);

  } catch (error:any) {
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

// @desc    Delete image from Cloudinary
// @route   DELETE /api/upload/:publicId
// @access  Private
export const deleteImage = async (req:AuthRequest, res:Response) => {
  try {
    const publicId = req.params.publicId?.replace(/-/g, '/');
    
    const result = await cloudinary.uploader.destroy(publicId!);
    
    if (result.result === 'ok') {
      res.json({ message: 'Image deleted successfully' });
    } else {
      res.status(400).json({ message: 'Failed to delete image' });
    }
  } catch (error:any) {
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};
