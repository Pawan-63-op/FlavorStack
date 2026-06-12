export interface RegisterCustomerDto {
  name: string;
  email: string;
  phone: string;
  password: string; // plaintext — hashed inside use-case
  referralCode?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    pinCode: string;
    lat: number;
    lng: number;
    label?: string;
  };
}
