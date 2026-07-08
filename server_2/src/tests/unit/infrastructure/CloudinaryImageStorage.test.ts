import {
  CloudinaryImageStorage,
  CloudinaryClient,
} from '../../../infrastructure/external/cloudinary/CloudinaryImageStorage';

function makeClient(overrides: Partial<jest.Mocked<CloudinaryClient>> = {}): jest.Mocked<CloudinaryClient> {
  return {
    uploadBuffer: jest.fn(),
    destroy: jest.fn(),
    ...overrides,
  } as jest.Mocked<CloudinaryClient>;
}

describe('CloudinaryImageStorage', () => {
  it('uploads the buffer and maps secure_url/public_id to the domain shape', async () => {
    const uploadBuffer = jest.fn().mockResolvedValue({
      secure_url: 'https://res.cloudinary.com/demo/image/upload/restaurants/1/abc.png',
      public_id: 'restaurants/1/abc',
    });
    const storage = new CloudinaryImageStorage(makeClient({ uploadBuffer }));
    const buffer = Buffer.from('img-bytes');

    const result = await storage.upload({ buffer, folder: 'restaurants/1' });

    expect(result).toEqual({
      url: 'https://res.cloudinary.com/demo/image/upload/restaurants/1/abc.png',
      publicId: 'restaurants/1/abc',
    });
    expect(uploadBuffer).toHaveBeenCalledWith(buffer, { folder: 'restaurants/1', publicId: undefined });
  });

  it('forwards an explicit fileName as the publicId', async () => {
    const uploadBuffer = jest.fn().mockResolvedValue({ secure_url: 'https://x/y.png', public_id: 'restaurants/1/hero' });
    const storage = new CloudinaryImageStorage(makeClient({ uploadBuffer }));

    await storage.upload({ buffer: Buffer.from('b'), folder: 'restaurants/1', fileName: 'hero' });

    expect(uploadBuffer).toHaveBeenCalledWith(expect.any(Buffer), { folder: 'restaurants/1', publicId: 'hero' });
  });

  it('delegates delete to the client destroy', async () => {
    const destroy = jest.fn().mockResolvedValue(undefined);
    const storage = new CloudinaryImageStorage(makeClient({ destroy }));

    await storage.delete('restaurants/1/abc');

    expect(destroy).toHaveBeenCalledWith('restaurants/1/abc');
  });
});
