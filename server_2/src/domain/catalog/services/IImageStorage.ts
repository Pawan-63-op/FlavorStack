export interface UploadedImage {
  url: string;
  publicId: string;
}

export interface IImageStorage {
  upload(input: { buffer: Buffer; folder: string; fileName?: string }): Promise<UploadedImage>;
  delete(publicId: string): Promise<void>;
}
