import { IImageStorage, UploadedImage } from '../../../domain/catalog/services/IImageStorage';

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
}

export interface CloudinaryClient {
  uploadBuffer(buffer: Buffer, options: { folder: string; publicId?: string }): Promise<CloudinaryUploadResult>;
  destroy(publicId: string): Promise<void>;
}

export class CloudinaryImageStorage implements IImageStorage {
  constructor(private readonly client: CloudinaryClient) {}

  async upload(input: { buffer: Buffer; folder: string; fileName?: string }): Promise<UploadedImage> {
    const result = await this.client.uploadBuffer(input.buffer, {
      folder: input.folder,
      publicId: input.fileName,
    });
    return { url: result.secure_url, publicId: result.public_id };
  }

  async delete(publicId: string): Promise<void> {
    await this.client.destroy(publicId);
  }
}
