import { DeviceContext } from './shared';

export interface RefreshTokenDto extends DeviceContext {
  refreshToken: string;
}
