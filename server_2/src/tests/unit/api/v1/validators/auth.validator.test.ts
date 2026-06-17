import {
  registerSchema,
  loginSchema,
  otpCodeSchema,
  phoneSchema,
  forgotSchema,
  resetSchema,
  changePasswordSchema,
} from '../../../../../api/v1/validators/auth.validator';

const STRONG_PASSWORD = 'Str0ng!Pass';

describe('auth.validator', () => {
  describe('registerSchema', () => {
    const validCustomer = {
      role: 'CUSTOMER',
      customer: {
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+12025550123',
        password: STRONG_PASSWORD,
      },
    };

    const validDriver = {
      role: 'DRIVER',
      driver: {
        name: 'John Driver',
        email: 'john@example.com',
        phone: '+12025550124',
        password: STRONG_PASSWORD,
        vehicle: {
          type: 'bike',
          brand: 'Honda',
          model: 'Activa',
          licensePlate: 'XX-1234',
          rcDocumentUrl: 'https://example.com/rc.pdf',
          insuranceUrl: 'https://example.com/insurance.pdf',
        },
      },
    };

    it('accepts a valid customer registration payload', () => {
      expect(registerSchema.safeParse(validCustomer).success).toBe(true);
    });

    it('accepts a valid customer registration with optional address', () => {
      const withAddress = {
        ...validCustomer,
        customer: {
          ...validCustomer.customer,
          referralCode: 'REF123',
          address: {
            street: '123 Main St',
            city: 'Metropolis',
            state: 'NY',
            pinCode: '10001',
            lat: 40.7128,
            lng: -74.006,
            label: 'Home',
          },
        },
      };
      expect(registerSchema.safeParse(withAddress).success).toBe(true);
    });

    it('accepts a valid driver registration payload', () => {
      expect(registerSchema.safeParse(validDriver).success).toBe(true);
    });

    it('rejects a role/payload mismatch (customer role with driver payload)', () => {
      const mismatched = { role: 'CUSTOMER', driver: validDriver.driver };
      expect(registerSchema.safeParse(mismatched).success).toBe(false);
    });

    it('rejects an unsupported role (e.g. ADMIN)', () => {
      const adminPayload = { role: 'ADMIN', customer: validCustomer.customer };
      expect(registerSchema.safeParse(adminPayload).success).toBe(false);
    });

    it('rejects a weak password', () => {
      const weak = { ...validCustomer, customer: { ...validCustomer.customer, password: 'weak' } };
      expect(registerSchema.safeParse(weak).success).toBe(false);
    });

    it('rejects an invalid email', () => {
      const badEmail = { ...validCustomer, customer: { ...validCustomer.customer, email: 'not-an-email' } };
      expect(registerSchema.safeParse(badEmail).success).toBe(false);
    });

    it('rejects an invalid phone number', () => {
      const badPhone = { ...validCustomer, customer: { ...validCustomer.customer, phone: '12345' } };
      expect(registerSchema.safeParse(badPhone).success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('accepts a valid login payload', () => {
      expect(loginSchema.safeParse({ email: 'jane@example.com', password: 'anything' }).success).toBe(true);
    });

    it('rejects an empty password', () => {
      expect(loginSchema.safeParse({ email: 'jane@example.com', password: '' }).success).toBe(false);
    });

    it('rejects an invalid email', () => {
      expect(loginSchema.safeParse({ email: 'not-an-email', password: 'anything' }).success).toBe(false);
    });
  });

  describe('otpCodeSchema', () => {
    it('accepts a 6-digit code', () => {
      expect(otpCodeSchema.safeParse({ code: '123456' }).success).toBe(true);
    });

    it('rejects a non-6-digit code', () => {
      expect(otpCodeSchema.safeParse({ code: '12345' }).success).toBe(false);
      expect(otpCodeSchema.safeParse({ code: 'abcdef' }).success).toBe(false);
    });
  });

  describe('phoneSchema', () => {
    it('accepts a valid E.164 phone number', () => {
      expect(phoneSchema.safeParse({ phone: '+12025550123' }).success).toBe(true);
    });

    it('rejects an invalid phone number', () => {
      expect(phoneSchema.safeParse({ phone: '02025550123' }).success).toBe(false);
    });
  });

  describe('forgotSchema', () => {
    it('accepts a valid email', () => {
      expect(forgotSchema.safeParse({ email: 'jane@example.com' }).success).toBe(true);
    });

    it('rejects an invalid email', () => {
      expect(forgotSchema.safeParse({ email: 'nope' }).success).toBe(false);
    });
  });

  describe('resetSchema', () => {
    it('accepts a valid reset payload', () => {
      const result = resetSchema.safeParse({ email: 'jane@example.com', code: '123456', newPassword: STRONG_PASSWORD });
      expect(result.success).toBe(true);
    });

    it('rejects a weak new password', () => {
      const result = resetSchema.safeParse({ email: 'jane@example.com', code: '123456', newPassword: 'weak' });
      expect(result.success).toBe(false);
    });

    it('rejects a malformed code', () => {
      const result = resetSchema.safeParse({ email: 'jane@example.com', code: '12', newPassword: STRONG_PASSWORD });
      expect(result.success).toBe(false);
    });
  });

  describe('changePasswordSchema', () => {
    it('accepts a valid change-password payload', () => {
      const result = changePasswordSchema.safeParse({ currentPassword: 'whatever', newPassword: STRONG_PASSWORD });
      expect(result.success).toBe(true);
    });

    it('rejects an empty current password', () => {
      const result = changePasswordSchema.safeParse({ currentPassword: '', newPassword: STRONG_PASSWORD });
      expect(result.success).toBe(false);
    });

    it('rejects a weak new password', () => {
      const result = changePasswordSchema.safeParse({ currentPassword: 'whatever', newPassword: 'weak' });
      expect(result.success).toBe(false);
    });
  });
});
