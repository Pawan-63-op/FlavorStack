// IImageStorage stand-in used until the Cloudinary provider (cloudinary SDK +
// circuit breaker) is wired. Keeps the API edge fully functional and testable:
// the domain only ever stores the returned URL, so swapping this for
// CloudinaryImageStorage later is a container-only change (no domain/app churn).
import { randomUUID } from 'crypto';
import { IImageStorage, UploadedImage } from '../../../domain/catalog/services/IImageStorage';

export class InMemoryImageStorage implements IImageStorage {
  private readonly store = new Map<string, Buffer>();

  async upload(input: { buffer: Buffer; folder: string; fileName?: string }): Promise<UploadedImage> {
    const publicId = `${input.folder}/${input.fileName ?? randomUUID()}`;
    this.store.set(publicId, input.buffer);
    return { publicId, url: `memory://${publicId}` };
  }

  async delete(publicId: string): Promise<void> {
    this.store.delete(publicId);
  }
}
