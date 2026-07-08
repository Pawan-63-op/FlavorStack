import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryClient, CloudinaryUploadResult } from './CloudinaryImageStorage';
import { CloudinaryConfig } from '../../../config/cloudinary';

export class RealCloudinaryClient implements CloudinaryClient {
  constructor(config: CloudinaryConfig) {
    cloudinary.config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      secure: true,
    });
  }

  uploadBuffer(buffer: Buffer, options: { folder: string; publicId?: string }): Promise<CloudinaryUploadResult> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: options.folder, public_id: options.publicId, resource_type: 'image', overwrite: true },
        (error, result) => {
          if (error || !result) {
            reject(error ?? new Error('Cloudinary upload returned no result'));
            return;
          }
          resolve({ secure_url: result.secure_url, public_id: result.public_id });
        }
      );
      stream.end(buffer);
    });
  }

  async destroy(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  }
}
