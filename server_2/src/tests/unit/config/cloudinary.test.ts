import { getCloudinaryConfig } from '../../../config/cloudinary';

describe('getCloudinaryConfig', () => {
  it('returns null when any credential is missing', () => {
    expect(getCloudinaryConfig({})).toBeNull();
    expect(getCloudinaryConfig({ CLOUDINARY_CLOUD_NAME: 'c' })).toBeNull();
    expect(getCloudinaryConfig({ CLOUDINARY_CLOUD_NAME: 'c', CLOUDINARY_API_KEY: 'k' })).toBeNull();
  });

  it('returns the config when all three credentials are present', () => {
    expect(
      getCloudinaryConfig({
        CLOUDINARY_CLOUD_NAME: 'c',
        CLOUDINARY_API_KEY: 'k',
        CLOUDINARY_API_SECRET: 's',
      })
    ).toEqual({ cloudName: 'c', apiKey: 'k', apiSecret: 's' });
  });
});
