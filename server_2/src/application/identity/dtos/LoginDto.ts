import { DeviceContext } from './shared';

export interface LoginDto extends DeviceContext {
  email: string;
  password: string;
}
