import { randomUUID } from 'crypto';
import { orderRequestIdParam } from '../../../../../api/v1/validators/commerce/order-request.validator';

describe('order-request.validator', () => {
  describe('orderRequestIdParam', () => {
    it('accepts a UUID id param', () => {
      const result = orderRequestIdParam.safeParse({ id: randomUUID() });
      expect(result.success).toBe(true);
    });

    it('rejects a non-UUID id param', () => {
      const result = orderRequestIdParam.safeParse({ id: 'not-a-uuid' });
      expect(result.success).toBe(false);
    });
  });
});
