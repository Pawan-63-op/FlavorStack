import { ApplyPromotion } from '../../../../application/commerce/use-cases/ApplyPromotion';
import { RemovePromotion } from '../../../../application/commerce/use-cases/RemovePromotion';
import { ValidatePromotion } from '../../../../application/commerce/use-cases/ValidatePromotion';
import { InMemoryCartRepository } from '../../../mocks/commerce.mocks';
import { InMemoryUnitOfWork } from '../../../mocks/identity.mocks';
import { PromotionService } from '../../../../infrastructure/services/PromotionService';
import { Coupon } from '../../../../domain/commerce/value-objects/Coupon';
import { Cart } from '../../../../domain/commerce/entities/Cart';
import { LineItemSelection } from '../../../../domain/commerce/value-objects/LineItemSelection';
import { Money } from '../../../../domain/shared/Money';
import { PROMOTION_KIND } from '../../../../domain/commerce/enums/promotion-kind.enum';

const money = (amount: number, currency = 'INR') => Money.create(amount, currency).getValue();

function selection(qty = 2) {
  return LineItemSelection.create({ menuItemId: 'menu-1', selectedOptionIds: [], quantity: qty }).getValue();
}

const couponCatalog = [
  Coupon.create({ code: 'SAVE10', kind: PROMOTION_KIND.PERCENTAGE, currency: 'INR', percentageOff: 10 }).getValue(),
  Coupon.create({
    code: 'FLAT50',
    kind: PROMOTION_KIND.FIXED,
    currency: 'INR',
    fixedAmountOff: money(5000),
    minOrderSubtotal: money(30000),
  }).getValue(),
];

async function seedCart(repo: InMemoryCartRepository, unit = 10000, qty = 2): Promise<Cart> {
  const cart = Cart.create('customer-1').getValue();
  cart.addItem('restaurant-1', selection(qty), money(unit));
  cart.pullDomainEvents();
  await repo.save(cart);
  return cart;
}

describe('Promotion use-cases', () => {
  let cartRepo: InMemoryCartRepository;
  let unitOfWork: InMemoryUnitOfWork;
  let promotionService: PromotionService;

  beforeEach(() => {
    cartRepo = new InMemoryCartRepository();
    unitOfWork = new InMemoryUnitOfWork();
    promotionService = new PromotionService(couponCatalog);
  });

  describe('ApplyPromotion', () => {
    it('applies a valid promotion and persists', async () => {
      await seedCart(cartRepo); // subtotal 20000
      const uc = new ApplyPromotion(cartRepo, promotionService, unitOfWork);

      const result = await uc.execute({ customerId: 'customer-1', code: 'SAVE10' });

      expect(result.isSuccess).toBe(true);
      expect(result.getValue().appliedPromotion!.discount.amount).toBe(2000);
      expect(unitOfWork.committed).toBe(true);

      const saved = await cartRepo.findByCustomerId('customer-1');
      expect(saved!.appliedPromotion!.code).toBe('SAVE10');
    });

    it('fails when no cart exists', async () => {
      const uc = new ApplyPromotion(cartRepo, promotionService, unitOfWork);
      const result = await uc.execute({ customerId: 'ghost', code: 'SAVE10' });
      expect(result.isFailure).toBe(true);
    });

    it('fails for an unknown code', async () => {
      await seedCart(cartRepo);
      const uc = new ApplyPromotion(cartRepo, promotionService, unitOfWork);
      const result = await uc.execute({ customerId: 'customer-1', code: 'NOPE' });
      expect(result.isFailure).toBe(true);
    });

    it('fails when the min-order is not met', async () => {
      await seedCart(cartRepo, 10000, 2); // subtotal 20000 < 30000
      const uc = new ApplyPromotion(cartRepo, promotionService, unitOfWork);
      const result = await uc.execute({ customerId: 'customer-1', code: 'FLAT50' });
      expect(result.isFailure).toBe(true);
    });
  });

  describe('ValidatePromotion', () => {
    it('returns a preview without persisting', async () => {
      await seedCart(cartRepo);
      const uc = new ValidatePromotion(cartRepo, promotionService);

      const result = await uc.execute({ customerId: 'customer-1', code: 'SAVE10' });

      expect(result.isSuccess).toBe(true);
      expect(result.getValue().applicable).toBe(true);
      expect(result.getValue().promotion.discount.amount).toBe(2000);

      const saved = await cartRepo.findByCustomerId('customer-1');
      expect(saved!.appliedPromotion).toBeNull();
    });

    it('fails for an ineligible code', async () => {
      await seedCart(cartRepo, 10000, 2);
      const uc = new ValidatePromotion(cartRepo, promotionService);
      const result = await uc.execute({ customerId: 'customer-1', code: 'FLAT50' });
      expect(result.isFailure).toBe(true);
    });
  });

  describe('RemovePromotion', () => {
    it('clears an applied promotion and persists', async () => {
      await seedCart(cartRepo);
      await new ApplyPromotion(cartRepo, promotionService, unitOfWork).execute({ customerId: 'customer-1', code: 'SAVE10' });

      const uc = new RemovePromotion(cartRepo, unitOfWork);
      const result = await uc.execute({ customerId: 'customer-1' });

      expect(result.isSuccess).toBe(true);
      expect(result.getValue().appliedPromotion).toBeNull();
      const saved = await cartRepo.findByCustomerId('customer-1');
      expect(saved!.appliedPromotion).toBeNull();
    });

    it('fails when no promotion is applied', async () => {
      await seedCart(cartRepo);
      const uc = new RemovePromotion(cartRepo, unitOfWork);
      const result = await uc.execute({ customerId: 'customer-1' });
      expect(result.isFailure).toBe(true);
    });
  });
});
