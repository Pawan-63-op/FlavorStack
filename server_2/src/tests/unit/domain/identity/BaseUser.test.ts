import { Customer } from '../../../../domain/identity/entities/Customer';

function makeCustomer(): Customer {
  const customer = Customer.create({
    name: 'Original Name',
    email: 'profile@example.com',
    phone: '+919876543210',
    passwordHash: 'hashed:Password1!',
    referralCode: 'REF00001',
  });
  customer.pullDomainEvents();
  return customer;
}

describe('BaseUser.updateProfile', () => {
  it('updates name and avatarUrl when both are provided', () => {
    const user = makeCustomer();

    user.updateProfile({ name: 'New Name', avatarUrl: 'https://example.com/avatar.png' });

    expect(user.name).toBe('New Name');
    expect(user.avatarUrl).toBe('https://example.com/avatar.png');
  });

  it('leaves a field unchanged when it is not provided', () => {
    const user = makeCustomer();
    user.avatarUrl = 'https://example.com/old.png';

    user.updateProfile({ name: 'Only Name Changed' });

    expect(user.name).toBe('Only Name Changed');
    expect(user.avatarUrl).toBe('https://example.com/old.png');
  });

  it('does not raise a domain event', () => {
    const user = makeCustomer();

    user.updateProfile({ name: 'Quiet Update' });

    expect(user.pullDomainEvents()).toHaveLength(0);
  });
});
