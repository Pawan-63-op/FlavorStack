import { Customer } from '../../../../domain/identity/entities/Customer';
import { USER_ROLE } from '../../../../domain/identity/enums/user-role.enum';
import { UserRegistered } from '../../../../domain/identity/events/UserRegistered';
import { DomainError } from '../../../../domain/shared/errors/DomainError';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';

describe('Customer Entity', () => {
  const validCustomerInput = {
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+919876543210',
    passwordHash: 'hashedpassword123',
    referralCode: 'REF12345',
  };

  describe('creation', () => {
    it('should create a valid customer, initialize wallet/loyalty defaults, and record UserRegistered event', () => {
      const customer = Customer.create(validCustomerInput);

      expect(customer).toBeDefined();
      expect(customer.name).toBe(validCustomerInput.name);
      expect(customer.email).toBe(validCustomerInput.email);
      expect(customer.role).toBe(USER_ROLE.CUSTOMER);
      expect(customer.walletBalance).toBe(0);
      expect(customer.walletCurrency).toBe('INR');
      expect(customer.loyaltyPoints).toBe(0);
      expect(customer.totalLifetimeSpend).toBe(0);
      expect(customer.referralCount).toBe(0);

      // Check domain event was recorded
      const events = customer.pullDomainEvents();
      expect(events.length).toBe(1);
      const event = events[0] as UserRegistered;
      expect(event).toBeInstanceOf(UserRegistered);
      expect(event.eventName).toBe('UserRegistered');
      expect(event.aggregateId).toBe(customer._id);
      expect(event.email).toBe(customer.email);
      expect(event.role).toBe(USER_ROLE.CUSTOMER);
      expect(event.name).toBe(customer.name);
    });
  });

  describe('wallet balance operations', () => {
    it('should deduct balance correctly when funds are sufficient', () => {
      const customer = Customer.create(validCustomerInput);
      customer.walletBalance = 5000; // ₹50.00 (in paise)

      customer.deductwallet(2000); // deduct ₹20.00
      expect(customer.walletBalance).toBe(3000); // ₹30.00 left
    });

    it('should throw DomainError("insufficient_balance") and not deduct when funds are insufficient', () => {
      const customer = Customer.create(validCustomerInput);
      customer.walletBalance = 1000; // ₹10.00 (in paise)

      expect(() => {
        customer.deductwallet(1500); // try to deduct ₹15.00
      }).toThrow(DomainError);

      try {
        customer.deductwallet(1500);
      } catch (err: any) {
        expect(err.code).toBe('DOMAIN_ERROR');
        expect(err.message).toBe('insufficient_balance');
      }

      expect(customer.walletBalance).toBe(1000); // unchanged
    });

    it('should throw ValidationError and not deduct when amount is negative', () => {
      const customer = Customer.create(validCustomerInput);
      customer.walletBalance = 2000;

      expect(() => {
        customer.deductwallet(-500);
      }).toThrow(ValidationError);

      expect(customer.walletBalance).toBe(2000); // unchanged
    });
  });

  describe('loyalty points operations', () => {
    it('should credit loyalty points correctly', () => {
      const customer = Customer.create(validCustomerInput);
      expect(customer.loyaltyPoints).toBe(0);

      customer.creditLoyaltyPoints(100);
      expect(customer.loyaltyPoints).toBe(100);
    });

    it('should throw ValidationError on negative loyalty credit', () => {
      const customer = Customer.create(validCustomerInput);

      expect(() => {
        customer.creditLoyaltyPoints(-50);
      }).toThrow(ValidationError);

      expect(customer.loyaltyPoints).toBe(0); // unchanged
    });

    it('should redeem loyalty points correctly when sufficient points are available', () => {
      const customer = Customer.create(validCustomerInput);
      customer.loyaltyPoints = 200;

      customer.redeemLoyaltyPoints(120);
      expect(customer.loyaltyPoints).toBe(80);
    });

    it('should throw DomainError("insufficient_points") and not redeem when points are insufficient', () => {
      const customer = Customer.create(validCustomerInput);
      customer.loyaltyPoints = 50;

      expect(() => {
        customer.redeemLoyaltyPoints(60);
      }).toThrow(DomainError);

      try {
        customer.redeemLoyaltyPoints(60);
      } catch (err: any) {
        expect(err.code).toBe('DOMAIN_ERROR');
        expect(err.message).toBe('insufficient_points');
      }

      expect(customer.loyaltyPoints).toBe(50); // unchanged
    });

    it('should throw ValidationError on negative loyalty redemption', () => {
      const customer = Customer.create(validCustomerInput);
      customer.loyaltyPoints = 100;

      expect(() => {
        customer.redeemLoyaltyPoints(-10);
      }).toThrow(ValidationError);

      expect(customer.loyaltyPoints).toBe(100); // unchanged
    });
  });
});
