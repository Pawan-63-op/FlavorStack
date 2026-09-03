import { checkoutSchema, previewCheckoutSchema } from '../../../../../api/v1/validators/checkout.validator';

const validAddress = {
  label: 'Home',
  street: '1 MG Road',
  city: 'Bengaluru',
  state: 'Karnataka',
  pinCode: '560001',
  coordinates: { lat: 12.97, lng: 77.59 },
};

describe('checkout.validator', () => {
  describe('checkoutSchema', () => {
    it('accepts a well-formed checkout body', () => {
      const result = checkoutSchema.safeParse({ paymentMethod: 'UPI', deliveryAddress: validAddress });
      expect(result.success).toBe(true);
    });

    it('accepts a body without the optional address label', () => {
      const { label: _label, ...addressNoLabel } = validAddress;
      const result = checkoutSchema.safeParse({ paymentMethod: 'COD', deliveryAddress: addressNoLabel });
      expect(result.success).toBe(true);
    });

    it('rejects an unknown payment method', () => {
      const result = checkoutSchema.safeParse({ paymentMethod: 'BITCOIN', deliveryAddress: validAddress });
      expect(result.success).toBe(false);
    });

    it('accepts addressId instead of an inline delivery address', () => {
      const result = checkoutSchema.safeParse({ paymentMethod: 'UPI', addressId: 'addr-1' });
      expect(result.success).toBe(true);
    });

    it('rejects a body with neither addressId nor a delivery address', () => {
      const result = checkoutSchema.safeParse({ paymentMethod: 'UPI' });
      expect(result.success).toBe(false);
    });

    it('rejects a blank addressId', () => {
      const result = checkoutSchema.safeParse({ paymentMethod: 'UPI', addressId: '   ' });
      expect(result.success).toBe(false);
    });

    it('rejects out-of-range coordinates', () => {
      const result = checkoutSchema.safeParse({
        paymentMethod: 'UPI',
        deliveryAddress: { ...validAddress, coordinates: { lat: 200, lng: 0 } },
      });
      expect(result.success).toBe(false);
    });

    it('rejects a blank required address field', () => {
      const result = checkoutSchema.safeParse({
        paymentMethod: 'UPI',
        deliveryAddress: { ...validAddress, street: '   ' },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('previewCheckoutSchema', () => {
    it('accepts a well-formed delivery point', () => {
      const result = previewCheckoutSchema.safeParse({ deliveryPoint: { lat: 12.97, lng: 77.59 } });
      expect(result.success).toBe(true);
    });

    it('accepts addressId instead of a delivery point', () => {
      const result = previewCheckoutSchema.safeParse({ addressId: 'addr-1' });
      expect(result.success).toBe(true);
    });

    it('rejects a body with neither addressId nor a delivery point', () => {
      const result = previewCheckoutSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('rejects out-of-range coordinates', () => {
      const result = previewCheckoutSchema.safeParse({ deliveryPoint: { lat: 200, lng: 0 } });
      expect(result.success).toBe(false);
    });
  });
});
