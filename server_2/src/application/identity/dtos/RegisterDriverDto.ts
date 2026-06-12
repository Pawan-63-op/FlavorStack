export interface RegisterDriverDto {
  name: string;
  email: string;
  phone: string;
  password: string;
  vehicle: {
    type: string;
    brand: string;
    model: string;
    licensePlate: string;
    rcDocumentUrl: string;
    insuranceUrl: string;
  };
}
