import { PhoneNumber } from '../value-objects/PhoneNumber.vo';

export interface ISmsProvider {
  sendOtp(phone: PhoneNumber, code: string): Promise<void>;
}
